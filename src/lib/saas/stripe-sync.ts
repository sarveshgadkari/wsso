import { supabaseAdmin } from '@/lib/supabase/admin'
import {
  getStripe,
  invoiceSubscriptionId,
  stripeCustomerId,
  stripePeriodEndUnix,
} from '@/lib/saas/stripe'
import { periodEndFromInterval, planEnumFromSlug } from '@/lib/saas/plans'

export async function fulfillCheckoutSession(sessionId: string) {
  const stripe = getStripe()
  if (!stripe) return

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription'],
  })
  if (session.status !== 'complete' && session.payment_status !== 'paid') return

  const orgId = session.metadata?.organization_id || session.client_reference_id || undefined
  const planId = session.metadata?.plan_id
  const interval = (session.metadata?.interval === 'year' ? 'year' : 'month') as 'month' | 'year'
  const previousSubId = session.metadata?.previous_subscription_id
  if (!orgId || !planId) return

  const { data: plan } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('id', planId)
    .single()
  if (!plan) return

  const sub = session.subscription
  const periodEndUnix = stripePeriodEndUnix(sub)
  const periodEnd = periodEndUnix
    ? new Date(periodEndUnix * 1000).toISOString()
    : periodEndFromInterval(interval).toISOString()
  const subscriptionId = typeof session.subscription === 'string'
    ? session.subscription
    : sub && typeof sub !== 'string'
      ? sub.id
      : undefined

  await supabaseAdmin
    .from('organizations')
    .update({
      plan_id: plan.id,
      plan: planEnumFromSlug(plan.slug),
      seat_limit: plan.seat_limit,
      status: 'active',
      billing_interval: interval,
      current_period_end: periodEnd,
      trial_ends_at: null,
      stripe_customer_id: stripeCustomerId(session.customer),
      stripe_subscription_id: subscriptionId,
    })
    .eq('id', orgId)

  await supabaseAdmin
    .from('organization_payments')
    .update({
      status: 'paid',
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id:
        typeof session.payment_intent === 'string' ? session.payment_intent : null,
    })
    .eq('stripe_checkout_session_id', session.id)

  if (previousSubId && previousSubId !== subscriptionId) {
    await stripe.subscriptions.cancel(previousSubId).catch(() => undefined)
  }
}

/**
 * Stripe redirects to ?success=1 before (or even if) the webhook runs.
 * If the workspace is still past_due, finish any pending Checkout session that Stripe already marked paid.
 */
export async function recoverPaidCheckout(organizationId: string): Promise<boolean> {
  const { data: pending } = await supabaseAdmin
    .from('organization_payments')
    .select('stripe_checkout_session_id')
    .eq('organization_id', organizationId)
    .eq('status', 'pending')
    .eq('provider', 'stripe')
    .not('stripe_checkout_session_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(8)

  const stripe = getStripe()
  if (!stripe || !pending?.length) return false

  for (const row of pending) {
    const sessionId = row.stripe_checkout_session_id
    if (!sessionId) continue
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId)
      if (session.status !== 'complete' && session.payment_status !== 'paid') continue
    } catch {
      continue
    }
    await fulfillCheckoutSession(sessionId)
    return true
  }

  return false
}

export async function applyStripeSubscriptionEvent(sub: {
  id: string
  status: string
  current_period_end?: number
  items?: { data?: Array<{ current_period_end?: number }> }
  customer?: string | { id: string }
  metadata?: Record<string, string>
}) {
  const customerId = stripeCustomerId(sub.customer)
  let orgId = sub.metadata?.organization_id

  if (!orgId && customerId) {
    const { data } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    orgId = data?.id
  }
  if (!orgId) {
    const { data } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('stripe_subscription_id', sub.id)
      .maybeSingle()
    orgId = data?.id
  }
  if (!orgId) return

  const periodEndUnix = stripePeriodEndUnix(sub)
  const stillCovered = Boolean(periodEndUnix && periodEndUnix * 1000 > Date.now())
  const stripeStatus = sub.status

  let orgStatus: 'active' | 'past_due' | 'cancelled' | 'trial' = 'past_due'
  let subscriptionId: string | null = sub.id

  if (stripeStatus === 'incomplete') {
    // Checkout often emits this before the first invoice settles. Do not relock a paid workspace.
    return
  }

  if (stripeStatus === 'active' || stripeStatus === 'trialing') {
    orgStatus = stripeStatus === 'trialing' ? 'trial' : 'active'
  } else if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') {
    orgStatus = 'past_due'
  } else if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired') {
    orgStatus = stillCovered ? 'active' : 'past_due'
    subscriptionId = null
  }

  await supabaseAdmin
    .from('organizations')
    .update({
      status: orgStatus,
      stripe_subscription_id: subscriptionId,
      current_period_end: periodEndUnix
        ? new Date(periodEndUnix * 1000).toISOString()
        : undefined,
    })
    .eq('id', orgId)
}

export async function syncOrgFromPaidInvoice(invoice: {
  id: string
  customer?: unknown
  amount_paid?: number
  billing_reason?: string | null
  subscription?: unknown
  parent?: unknown
}) {
  if (!invoice.amount_paid || invoice.amount_paid <= 0) return
  if (invoice.billing_reason === 'subscription_create') return

  const stripe = getStripe()
  if (!stripe) return

  const customerId = stripeCustomerId(invoice.customer)
  const subId = invoiceSubscriptionId(invoice)
  if (!customerId && !subId) return

  let orgQuery = supabaseAdmin.from('organizations').select('id, plan_id, billing_interval')
  if (subId) orgQuery = orgQuery.eq('stripe_subscription_id', subId)
  else orgQuery = orgQuery.eq('stripe_customer_id', customerId!)

  const { data: org } = await orgQuery.maybeSingle()
  if (!org) return

  if (subId) {
    const sub = await stripe.subscriptions.retrieve(subId)
    await applyStripeSubscriptionEvent(sub)
  }

  const { data: existing } = await supabaseAdmin
    .from('organization_payments')
    .select('id')
    .eq('stripe_payment_intent_id', invoice.id)
    .maybeSingle()
  if (existing) return

  await supabaseAdmin.from('organization_payments').insert({
    organization_id: org.id,
    plan_id: org.plan_id,
    amount_cents: invoice.amount_paid,
    billing_interval: org.billing_interval ?? 'month',
    status: 'paid',
    provider: 'stripe',
    stripe_payment_intent_id: invoice.id,
    paid_at: new Date().toISOString(),
    notes: invoice.billing_reason === 'subscription_cycle' ? 'Stripe renewal' : 'Stripe invoice',
  })
}

export async function markOrgPastDueFromInvoice(invoice: { customer?: unknown; subscription?: unknown; parent?: unknown }) {
  const customerId = stripeCustomerId(invoice.customer)
  const subId = invoiceSubscriptionId(invoice)

  let orgQuery = supabaseAdmin.from('organizations').select('id')
  if (subId) orgQuery = orgQuery.eq('stripe_subscription_id', subId)
  else if (customerId) orgQuery = orgQuery.eq('stripe_customer_id', customerId)
  else return

  const { data: org } = await orgQuery.maybeSingle()
  if (!org) return

  await supabaseAdmin
    .from('organizations')
    .update({ status: 'past_due' })
    .eq('id', org.id)
}
