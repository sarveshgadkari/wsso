import { supabaseAdmin } from '@/lib/supabase/admin'

export interface ProfileBrief {
  id:            string
  full_name:     string
  employee_code: string
}

const UNKNOWN_PROFILE = (id: string): ProfileBrief => ({
  id,
  full_name:     'Unknown',
  employee_code: '—',
})

export async function loadProfilesByIds(
  ids: string[],
): Promise<Record<string, ProfileBrief>> {
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (unique.length === 0) return {}

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, employee_code')
    .in('id', unique)

  return Object.fromEntries(
    ((data ?? []) as ProfileBrief[]).map(p => [p.id, p]),
  )
}

export function resolveProfile(
  id: string,
  map: Record<string, ProfileBrief>,
  fallback?: ProfileBrief | null,
): ProfileBrief {
  return map[id] ?? fallback ?? UNKNOWN_PROFILE(id)
}

/** Fill assignee/creator on tactic rows — profile embeds fail under RLS for employees. */
export async function enrichTacticRows<T extends {
  assigned_to: string
  created_by:  string
  assignee?:   ProfileBrief | null
  creator?:    ProfileBrief | null
}>(rows: T[]): Promise<(T & { assignee: ProfileBrief; creator: ProfileBrief })[]> {
  if (rows.length === 0) return []

  const map = await loadProfilesByIds(
    rows.flatMap(r => [r.assigned_to, r.created_by]),
  )

  return rows.map(row => ({
    ...row,
    assignee: resolveProfile(row.assigned_to, map, row.assignee),
    creator:  resolveProfile(row.created_by,  map, row.creator),
  }))
}

/** Fill actor on activity log rows. */
export async function enrichActivityLogActors<T extends {
  employee_id: string
  actor?:      ProfileBrief | null
}>(rows: T[]): Promise<(T & { actor: ProfileBrief })[]> {
  if (rows.length === 0) return []

  const map = await loadProfilesByIds(rows.map(r => r.employee_id))

  return rows.map(row => ({
    ...row,
    actor: resolveProfile(row.employee_id, map, row.actor),
  }))
}
