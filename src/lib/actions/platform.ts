'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireSuperAdmin } from '@/lib/auth/session'
import { sendSetPasswordEmail } from '@/lib/email/send-set-password-email'
import { buildSetPasswordCallbackUrl } from '@/lib/auth/set-password-link'
import {
  slugify,
  planEnumFromSlug,
  periodEndFromInterval,
} from '@/lib/saas/plans'
import type { OrgStatus } from '@/lib/types'
import type { Database } from '@/lib/types/database'

const createOrgSchema = z.object({
  name:              z.string().min(2, 'Workspace name is required').max(120),
  plan_id:           z.string().uuid('Select a plan'),
  billing_email:     z.string().email().optional().or(z.literal('')),
  notes:             z.string().max(2000).optional(),
  admin_full_name:   z.string().min(1, 'Admin name is required').max(120),
  admin_email:       z.string().email('Admin email is required'),
  start_trial:       z.boolean().optional(),
})

const updateOrgSchema = z.object({
  name:          z.string().min(2).max(120).optional(),
  plan_id:       z.string().uuid().optional(),
  status:        z.enum(['trial', 'active', 'past_due', 'suspended', 'cancelled']).optional(),
  seat_limit:    z.coerce.number().int().min(1).max(10000).optional(),
  billing_email: z.string().email().optional().or(z.literal('')).nullable(),
  notes:         z.string().max(2000).optional().nullable(),
  mcp_enabled:   z.boolean().optional(),
})

async function uniqueSlug(base: string): Promise<string> {
  const slug = slugify(base)
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`
    const { data } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle()
    if (!data) return candidate
  }
  return `${slug}-${randomBytes(3).toString('hex')}`
}

export async function createOrganization(input: z.infer<typeof createOrgSchema>) {
  await requireSuperAdmin()

  const parsed = createOrgSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.name?.[0]
      ?? parsed.error.flatten().fieldErrors.admin_email?.[0]
      ?? parsed.error.flatten().fieldErrors.plan_id?.[0]
      ?? 'Invalid input' }
  }

  const { name, plan_id, billing_email, notes, admin_full_name, admin_email, start_trial } = parsed.data

  const { data: plan } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('id', plan_id)
    .single()

  if (!plan) return { error: 'Select a valid plan' }

  const isFree = plan.monthly_price_cents === 0 && plan.yearly_price_cents === 0
  const useTrial = start_trial !== false && plan.trial_days > 0 && !isFree
  const status: OrgStatus = isFree ? 'active' : useTrial ? 'trial' : 'past_due'
  const trial_ends_at = useTrial
    ? new Date(Date.now() + plan.trial_days * 24 * 60 * 60 * 1000).toISOString()
    : null

  const slug = await uniqueSlug(name)

  const { data: org, error } = await supabaseAdmin
    .from('organizations')
    .insert({
      name,
      slug,
      plan: planEnumFromSlug(plan.slug),
      plan_id: plan.id,
      status,
      seat_limit: plan.seat_limit,
      trial_ends_at,
      billing_email: billing_email || admin_email,
      notes: notes || null,
      current_period_end: isFree ? periodEndFromInterval('month').toISOString() : null,
    })
    .select()
    .single()

  if (error || !org) {
    return { error: error?.message ?? 'Failed to create workspace' }
  }

  let adminInvite: { email_sent: boolean; set_password_link: string | null } | null = null

  const invited = await inviteOrgAdmin(org.id, admin_full_name, admin_email)
  if ('error' in invited && invited.error) {
    revalidatePath('/platform')
    return { data: org, warning: `Workspace created but admin invite failed: ${invited.error}` }
  }
  if ('data' in invited && invited.data) {
    adminInvite = {
      email_sent: invited.data.email_sent,
      set_password_link: invited.data.set_password_link,
    }
  }

  revalidatePath('/platform')
  return { data: org, adminInvite }
}

export async function updateOrganization(id: string, input: z.infer<typeof updateOrgSchema>) {
  await requireSuperAdmin()

  const parsed = updateOrgSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid input' }
  }

  const patch: Database['public']['Tables']['organizations']['Update'] = { ...parsed.data }
  if (parsed.data.billing_email === '') patch.billing_email = null

  if (parsed.data.plan_id) {
    const { data: plan } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', parsed.data.plan_id)
      .single()
    if (plan) {
      patch.plan = planEnumFromSlug(plan.slug)
      if (parsed.data.seat_limit === undefined) patch.seat_limit = plan.seat_limit
    }
  }

  const { data, error } = await supabaseAdmin
    .from('organizations')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/platform')
  revalidatePath(`/platform/organizations/${id}`)
  return { data }
}

export async function setOrganizationStatus(id: string, status: OrgStatus) {
  return updateOrganization(id, { status })
}

export async function inviteOrgAdmin(orgId: string, fullName: string, email: string) {
  await requireSuperAdmin()

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('id, seat_limit, name')
    .eq('id', orgId)
    .single()

  if (!org) return { error: 'Workspace not found' }

  const { count } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('status', 'active')

  if ((count ?? 0) >= org.seat_limit) {
    return { error: `Seat limit reached (${org.seat_limit}). Increase seats first.` }
  }

  const tempPassword = randomBytes(20).toString('hex')
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      role: 'admin',
      organization_id: orgId,
    },
  })

  if (authError || !authData.user) {
    return { error: authError?.message ?? 'Failed to create user' }
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: authData.user.id,
      full_name: fullName,
      email,
      role: 'admin',
      organization_id: orgId,
    }, { onConflict: 'id' })
    .select()
    .single()

  if (profileError || !profile) {
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
    return { error: profileError?.message ?? 'Failed to create profile' }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wsso.tlbisbig.world'
  const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${appUrl}/auth/callback?next=/reset-password` },
  })

  const setPasswordLink = linkData?.properties?.hashed_token
    ? buildSetPasswordCallbackUrl(linkData.properties.hashed_token)
    : linkData?.properties?.action_link ?? null

  const emailResult = await sendSetPasswordEmail({
    email,
    fullName,
    role: 'admin',
    employeeCode: profile.employee_code,
    setPasswordLink,
  })

  revalidatePath(`/platform/organizations/${orgId}`)
  return {
    data: {
      profile,
      email_sent: emailResult.sent,
      set_password_link: emailResult.sent ? null : setPasswordLink,
    },
  }
}
