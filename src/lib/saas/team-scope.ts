import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/lib/types'

export async function listManagedTeamIds(
  managerId: string,
  ownTeamId: string | null,
): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('teams').select('id').eq('manager_id', managerId)
  const ids = new Set((data ?? []).map((t) => t.id))
  if (ownTeamId) ids.add(ownTeamId)
  return Array.from(ids)
}

export function profileVisibleToManager(
  viewerId: string,
  managedTeamIds: string[],
  row: { id: string; manager_id?: string | null; team_id?: string | null },
): boolean {
  if (row.id === viewerId) return true
  if (row.manager_id === viewerId) return true
  if (row.team_id && managedTeamIds.includes(row.team_id)) return true
  return false
}

/** PostgREST `or` filter so a manager query never returns the whole company. */
export function managerProfileOrFilter(viewerId: string, managedTeamIds: string[]): string {
  const parts = [`id.eq.${viewerId}`, `manager_id.eq.${viewerId}`]
  if (managedTeamIds.length > 0) {
    parts.push(`team_id.in.(${managedTeamIds.join(',')})`)
  }
  return parts.join(',')
}

export async function managerScope(
  profile: Pick<Profile, 'id' | 'role' | 'team_id'>,
): Promise<{ teamIds: string[]; orFilter: string } | null> {
  if (profile.role !== 'manager') return null
  const teamIds = await listManagedTeamIds(profile.id, profile.team_id)
  return { teamIds, orFilter: managerProfileOrFilter(profile.id, teamIds) }
}

export function applyManagerProfileFilter<T extends { or: (filter: string) => T }>(
  query: T,
  scope: { orFilter: string } | null,
): T {
  return scope ? query.or(scope.orFilter) : query
}

/** Profile ids this manager may see. `null` means not a manager (no extra filter). */
export async function listVisibleProfileIds(
  profile: Pick<Profile, 'id' | 'role' | 'team_id'>,
): Promise<string[] | null> {
  const scope = await managerScope(profile)
  if (!scope) return null
  const supabase = await createClient()
  const { data } = await applyManagerProfileFilter(
    supabase.from('profiles').select('id'),
    scope,
  )
  return (data ?? []).map((p) => p.id)
}

export async function assertAssigneesOnManagerTeam(
  viewer: Pick<Profile, 'id' | 'role' | 'team_id'>,
  assigneeIds: string[],
): Promise<void> {
  if (viewer.role !== 'manager' || assigneeIds.length === 0) return
  const allowed = await listVisibleProfileIds(viewer)
  if (!allowed) return
  const allowedSet = new Set(allowed)
  if (assigneeIds.some((id) => !allowedSet.has(id))) {
    throw new Error('You can only assign people on your team')
  }
}
