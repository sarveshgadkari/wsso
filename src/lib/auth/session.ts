import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Organization, Profile, UserRole } from '@/lib/types'
import { orgHardBlocked } from '@/lib/saas/plans'

export function isSuperAdmin(profile: Pick<Profile, 'role'>): boolean {
  return profile.role === 'super_admin'
}

export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user ?? null
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return data ?? null
}

export async function getOrganization(orgId: string | null): Promise<Organization | null> {
  if (!orgId) return null
  const supabase = await createClient()
  const { data } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', orgId)
    .single()
  return data ?? null
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

export async function requireProfile() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  if (profile.status === 'inactive') {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login?error=account_inactive')
  }

  if (!isSuperAdmin(profile)) {
    const org = await getOrganization(profile.organization_id)
    if (!org) {
      const supabase = await createClient()
      await supabase.auth.signOut()
      redirect('/login?error=no_workspace')
    }
    if (orgHardBlocked(org)) {
      const supabase = await createClient()
      await supabase.auth.signOut()
      redirect('/login?error=org_blocked')
    }
  }

  return profile
}

export async function requireRole(allowed: UserRole[]) {
  const profile = await requireProfile()
  if (!allowed.includes(profile.role)) redirect('/dashboard')
  return profile
}

export async function requireSuperAdmin() {
  const profile = await requireProfile()
  if (!isSuperAdmin(profile)) redirect('/dashboard')
  return profile
}

export async function requireOrgContext() {
  const profile = await requireProfile()
  if (isSuperAdmin(profile) || !profile.organization_id) {
    redirect('/platform')
  }
  return profile
}
