// Find or create the WSSO account for a person who signed in through Omni Force Vector.
// Server-only (service role). Rules:
//   * The key is the Omni Force Vector user id (sub). Email is NEVER used to merge accounts.
//   * Personal access   → one personal workspace per person; they are its admin.
//   * Organization seat → one workspace per Omni Force Vector organization. Its owner
//     creates it on first sign-in; other members join it as employees.
//   * Workspaces created here are billed by Omni Force Vector: no WSSO payment, seats
//     and plan follow the Omni Force Vector entitlement.
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { planEnumFromSlug, slugify } from '@/lib/saas/plans'
import type { OmniforceClaims } from './oidc'

export class AccountError extends Error {
  constructor(public code: string, message: string) { super(message) }
}

type Org = { id: string; status: string; billing_source: 'wsso' | 'omniforce'; seat_limit: number }

async function uniqueSlug(base: string): Promise<string> {
  const slug = slugify(base)
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`
    const { data } = await supabaseAdmin.from('organizations').select('id').eq('slug', candidate).maybeSingle()
    if (!data) return candidate
  }
  return `${slug}-${randomBytes(3).toString('hex')}`
}

function accessFields(claims: OmniforceClaims) {
  const a = claims.omniforce_access
  const ref = a?.plan_ref ?? ''
  const isPlan = ['trial', 'starter', 'growth', 'business', 'enterprise'].includes(ref)
  return {
    ...(isPlan ? { plan: planEnumFromSlug(ref) } : {}),
    ...(a?.seats ? { seat_limit: a.seats } : {}),
  }
}

/** Keep an Omni Force Vector–billed workspace in line with the entitlement in this sign-in. */
async function applyAccess(org: Org, claims: OmniforceClaims) {
  if (org.billing_source !== 'omniforce') return
  await supabaseAdmin.from('organizations').update({
    ...accessFields(claims),
    status: 'active',          // access was just re-checked by Omni Force Vector
    trial_ends_at: null,
    current_period_end: null,  // never "payment due" inside WSSO
  }).eq('id', org.id)
}

async function createWorkspace(name: string, claims: OmniforceClaims, link: { owner?: string; organization?: string }): Promise<Org> {
  const { data, error } = await supabaseAdmin.from('organizations').insert({
    name: name.slice(0, 120),
    slug: await uniqueSlug(name),
    status: 'active',
    seat_limit: claims.omniforce_access?.seats ?? 10,
    ...accessFields(claims),
    billing_email: claims.email ?? null,
    billing_source: 'omniforce',
    omniforce_owner_user_id: link.owner ?? null,
    omniforce_organization_id: link.organization ?? null,
    notes: 'Created by Omni Force Vector sign-in. Billed by Omni Force Vector.',
  }).select('id, status, billing_source, seat_limit').single()
  if (error || !data) throw new AccountError('workspace_failed', error?.message ?? 'Could not create the workspace')
  return data as Org
}

async function findWorkspace(claims: OmniforceClaims): Promise<Org | null> {
  const cols = 'id, status, billing_source, seat_limit'
  if (claims.org) {
    if (claims.org.external_id) {
      const { data } = await supabaseAdmin.from('organizations').select(cols).eq('id', claims.org.external_id).maybeSingle()
      if (data) return data as Org
    }
    const { data } = await supabaseAdmin.from('organizations').select(cols).eq('omniforce_organization_id', claims.org.id).maybeSingle()
    return (data as Org) ?? null
  }
  const { data } = await supabaseAdmin.from('organizations').select(cols)
    .eq('omniforce_owner_user_id', claims.sub).is('omniforce_organization_id', null).maybeSingle()
  return (data as Org) ?? null
}

export type ResolvedAccount = { userId: string; email: string; organizationId: string; created: boolean; orgCreated: boolean }

export async function resolveAccount(claims: OmniforceClaims): Promise<ResolvedAccount> {
  if (claims.omniforce_access?.module !== 'wsso') throw new AccountError('no_access', 'Your Omni Force Vector plan does not include WSSO.')

  // 1. Already linked
  const { data: linked } = await supabaseAdmin.from('profiles')
    .select('id, email, status, organization_id').eq('omniforce_user_id', claims.sub).maybeSingle()
  if (linked) {
    if (linked.status === 'inactive') throw new AccountError('account_inactive', 'Your WSSO account was deactivated by your workspace admin.')
    // The sign-in context (personal or a given organization) must be the workspace this account lives in.
    const ws = await findWorkspace(claims)
    if (!ws || ws.id !== linked.organization_id) {
      throw new AccountError('workspace_mismatch', 'Your WSSO account belongs to a different workspace. Open WSSO from the matching account or organization in Omni Force Vector.')
    }
    await applyAccess(ws, claims)
    // lift a block placed by Omni Force Vector when access was removed earlier
    await supabaseAdmin.auth.admin.updateUserById(linked.id, { ban_duration: 'none' })
    return { userId: linked.id, email: linked.email, organizationId: linked.organization_id!, created: false, orgCreated: false }
  }

  // 2. New person
  const email = (claims.email ?? '').trim().toLowerCase()
  if (!email || claims.email_verified !== true) throw new AccountError('email_unverified', 'Verify your email in Omni Force Vector first.')

  // Never attach an Omni Force Vector identity to an existing WSSO login just because the email matches.
  const { data: sameEmail } = await supabaseAdmin.from('profiles').select('id')
    .ilike('email', email.replace(/[\\%_]/g, (c) => `\\${c}`)).limit(1).maybeSingle()
  if (sameEmail) {
    throw new AccountError('email_in_use', 'A WSSO account already uses this email. Sign in to WSSO with your password, or ask support to connect it.')
  }

  let org = await findWorkspace(claims)
  let orgCreated = false
  let role: 'admin' | 'employee' = 'admin'
  const fullName = claims.name?.trim() || [claims.given_name, claims.family_name].filter(Boolean).join(' ') || email.split('@')[0]

  if (claims.org) {
    const canCreate = claims.org.role === 'owner' || claims.org.role === 'admin'
    if (!org) {
      if (!canCreate) throw new AccountError('workspace_not_ready', `Ask an owner of ${claims.org.name} to open WSSO first. That creates your team's workspace.`)
      org = await createWorkspace(claims.org.name, claims, { owner: claims.sub, organization: claims.org.id })
      orgCreated = true
    }
    role = orgCreated || claims.org.role === 'owner' ? 'admin' : 'employee'
  } else if (!org) {
    org = await createWorkspace(`${claims.given_name || fullName}'s workspace`, claims, { owner: claims.sub })
    orgCreated = true
  }

  if (org.status === 'suspended' || org.status === 'cancelled') {
    if (org.billing_source === 'omniforce') await applyAccess(org, claims)
    else throw new AccountError('workspace_suspended', 'This WSSO workspace is suspended.')
  }
  if (!orgCreated) {
    const { data: canAdd } = await supabaseAdmin.rpc('org_can_add_seat', { p_org_id: org.id })
    if (canAdd === false) throw new AccountError('seat_limit', 'Every seat in this WSSO workspace is in use. Ask your admin to free one.')
  }

  // Auth user without a password: this person signs in through Omni Force Vector.
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, role, organization_id: org.id, auth_source: 'omniforce' },
  })
  if (error || !created.user) {
    if (orgCreated) await supabaseAdmin.from('organizations').delete().eq('id', org.id)
    throw new AccountError('email_in_use', 'A WSSO login already uses this email. Ask support to connect it.')
  }

  const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
    id: created.user.id,
    email,
    full_name: fullName,
    role,
    organization_id: org.id,
    omniforce_user_id: claims.sub,
    omniforce_linked_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (profileError) {
    await supabaseAdmin.auth.admin.deleteUser(created.user.id)
    if (orgCreated) await supabaseAdmin.from('organizations').delete().eq('id', org.id)
    throw new AccountError('profile_failed', profileError.message)
  }

  return { userId: created.user.id, email, organizationId: org.id, created: true, orgCreated }
}
