import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile, UserRole } from '@/lib/types'

// Call from Server Components and API route handlers.
// Returns null rather than throwing — lets callers decide how to handle no-session.

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

// Guards — redirect when the condition isn't met.
// Use at the top of Server Components that require auth.

export async function requireAuth() {
  const user = await getUser()
  if (!user) redirect('/login')
  return user
}

export async function requireProfile() {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  // Inactive accounts lose access immediately — sign out and send them to login
  if (profile.status === 'inactive') {
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/login?error=account_inactive')
  }

  return profile
}

// Throws/redirects if the current user's role isn't in the allowed list.
export async function requireRole(allowed: UserRole[]) {
  const profile = await requireProfile()
  if (!allowed.includes(profile.role)) redirect('/dashboard')
  return profile
}
