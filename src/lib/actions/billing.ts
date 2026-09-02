'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireSuperAdmin, requireRole } from '@/lib/auth/session'
import { getStripe, appUrl } from '@/lib/saas/stripe'
import {
  periodEndFromInterval,
  planEnumFromSlug,
  priceForInterval,
  slugify,
} from '@/lib/saas/plans'
import type { SubscriptionPlan } from '@/lib/types'

const planSchema = z.object({
  name:                z.string().min(2).max(80),
  description:         z.string().max(500).optional().nullable(),
  monthly_price_cents: z.coerce.number().int().min(0),
  yearly_price_cents:  z.coerce.number().int().min(0),
  seat_limit:          z.coerce.number().int().min(1).max(100000),
  trial_days:          z.coerce.number().int().min(0).max(365),
  is_active:           z.boolean().optional(),
  sort_order:          z.coerce.number().int().optional(),
})

async function uniquePlanSlug(base: string): Promise<string> {
  const slug = slugify(base)
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`
    const { data } = await supabaseAdmin
      .from('subscription_plans')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (!data) return candidate
  }
  return `${slug}-${Date.now().toString(36)}`
}

export async function createSubscriptionPlan(input: z.infer<typeof planSchema>) {
  await requireSuperAdmin()
  const parsed = planSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid plan' }

  const slug = await uniquePlanSlug(parsed.data.name)
  const { data, error } = await supabaseAdmin
    .from('subscription_plans')
    .insert({ ...parsed.data, slug, is_active: parsed.data.is_active ?? true })
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/platform/plans')
  revalidatePath('/platform')
  revalidatePath('/')
  return { data }
}

export async function updateSubscriptionPlan(id: string, input: z.infer<typeof planSchema>) {
  await requireSuperAdmin()
  const parsed = planSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid plan' }

  const { data, error } = await supabaseAdmin
    .from('subscription_plans')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }
  revalidatePath('/platform/plans')
  revalidatePath('/platform')
  revalidatePath('/')
  return { data }
}

export async function deleteSubscriptionPlan(id: string) {
  await requireSuperAdmin()
  if (!z.string().uuid().safeParse(id).success) return { error: 'Invalid plan' }

  const { data: plan } = await supabaseAdmin
    .from('subscription_plans')
    .select('id, name')
    .eq('id', id)
    .maybeSingle()
  if (!plan) return { error: 'Plan not found' }

  const { count } = await supabaseAdmin
    .from('organizations')
    .select('id', { count: 'exact', head: true })
    .eq('plan_id', id)

  const { error } = await supabaseAdmin
    .from('subscription_plans')
    .delete()
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/platform/plans')
  revalidatePath('/platform')
  revalidatePath('/')
  return { ok: true as const, name: plan.name, workspacesDetached: count ?? 0 }
}

export async function applyPlanToOrganization(orgId: string, plan: SubscriptionPlan, interval: 'month' | 'year' | null) {
  const trialDays = plan.trial_days
  const isFree = plan.monthly_price_cents === 0 && plan.yearly_price_cents === 0
  const status = isFree ? 'active' : trialDays > 0 ? 'trial' : 'past_due'
  const trial_ends_at = status === 'trial'
    ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000).toISOString()
    : null

  await supabaseAdmin
    .from('organizations')
    .update({
      plan_id: plan.id,
      plan: planEnumFromSlug(plan.slug),
      seat_limit: plan.seat_limit,
      status,
      trial_ends_at,
      billing_interval: interval,
      current_period_end: isFree && interval
        ? periodEndFromInterval(interval).toISOString()
        : null,
    })
    .eq('id', orgId)
}

export async function markOrganizationPaid(input: {
  organizationId: string
  planId: string
  interval: 'month' | 'year'
  notes?: string
}) {
  const profile = await requireSuperAdmin()

  const { data: plan } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('id', input.planId)
    .single()

  if (!plan) return { error: 'Plan not found' }

  const amount = priceForInterval(plan, input.interval)
  const periodEnd = periodEndFromInterval(input.interval).toISOString()

  const { error: payErr } = await supabaseAdmin
    .from('organization_payments')
    .insert({
      organization_id: input.organizationId,
      plan_id: plan.id,
      amount_cents: amount,
      billing_interval: input.interval,
      status: 'paid',
      provider: 'manual',
      notes: input.notes || 'Recorded by Super Admin',
      created_by: profile.id,
      paid_at: new Date().toISOString(),
    })

  if (payErr) return { error: payErr.message }

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({
      plan_id: plan.id,
      plan: planEnumFromSlug(plan.slug),
      seat_limit: plan.seat_limit,
      status: 'active',
      billing_interval: input.interval,
      current_period_end: periodEnd,
      trial_ends_at: null,
    })
    .eq('id', input.organizationId)

  if (error) return { error: error.message }

  revalidatePath('/platform')
  revalidatePath('/platform/payments')
  revalidatePath(`/platform/organizations/${input.organizationId}`)
  return { ok: true }
}

export async function startCheckout(planId: string, interval: 'month' | 'year') {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) return { error: 'No workspace' }

  const stripe = getStripe()
  if (!stripe) {
    return { error: 'Stripe is not configured. Add STRIPE_SECRET_KEY on the server.' }
  }

  const [{ data: plan }, { data: org }] = await Promise.all([
    supabaseAdmin.from('subscription_plans').select('*').eq('id', planId).eq('is_active', true).single(),
    supabaseAdmin.from('organizations').select('*').eq('id', profile.organization_id).single(),
  ])

  if (!plan || !org) return { error: 'Plan not available' }

  const amount = priceForInterval(plan, interval)
  if (amount <= 0) {
    await applyPlanToOrganization(org.id, plan, interval)
    await supabaseAdmin.from('organizations').update({
      status: 'active',
      current_period_end: periodEndFromInterval(interval).toISOString(),
      trial_ends_at: null,
    }).eq('id', org.id)
    revalidatePath('/settings/billing')
    return { url: `${appUrl()}/settings/billing?success=1` }
  }

  let customerId = org.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: org.billing_email || profile.email,
      name: org.name,
      metadata: { organization_id: org.id },
    })
    customerId = customer.id
    await supabaseAdmin.from('organizations').update({ stripe_customer_id: customerId }).eq('id', org.id)
  }

  const alreadyOnThisPlan =
    Boolean(org.stripe_subscription_id) &&
    org.status === 'active' &&
    org.plan_id === plan.id &&
    org.billing_interval === interval

  if (alreadyOnThisPlan) {
    const portal = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${appUrl()}/settings/billing`,
    })
    return { url: portal.url }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    client_reference_id: org.id,
    success_url: `${appUrl()}/settings/billing?success=1`,
    cancel_url: `${appUrl()}/settings/billing?canceled=1`,
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    payment_method_collection: 'always',
    metadata: {
      organization_id: org.id,
      plan_id: plan.id,
      interval,
      paid_by: profile.id,
      previous_subscription_id: org.stripe_subscription_id ?? '',
    },
    subscription_data: {
      metadata: { organization_id: org.id, plan_id: plan.id, interval },
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: amount,
          recurring: { interval },
          product_data: {
            name: `WSSO ${plan.name}`,
            description: `${plan.seat_limit} seats · billed ${interval === 'year' ? 'yearly' : 'monthly'}`,
          },
        },
      },
    ],
  })

  if (!session.url) return { error: 'Could not start checkout' }

  await supabaseAdmin.from('organization_payments').insert({
    organization_id: org.id,
    plan_id: plan.id,
    amount_cents: amount,
    billing_interval: interval,
    status: 'pending',
    provider: 'stripe',
    stripe_checkout_session_id: session.id,
    created_by: profile.id,
  })

  return { url: session.url }
}

export async function startBillingPortal() {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) return { error: 'No workspace' }

  const stripe = getStripe()
  if (!stripe) return { error: 'Stripe is not configured. Add STRIPE_SECRET_KEY on the server.' }

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('stripe_customer_id')
    .eq('id', profile.organization_id)
    .single()

  if (!org?.stripe_customer_id) {
    return { error: 'No Stripe customer yet. Subscribe first.' }
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: org.stripe_customer_id,
    return_url: `${appUrl()}/settings/billing`,
  })

  return { url: portal.url }
}
