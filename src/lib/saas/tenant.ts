import type { Profile } from '@/lib/types'

/** Workspace id for the signed-in company user. Super Admin has none. */
export function requireOrgId(profile: Pick<Profile, 'organization_id'>): string {
  if (!profile.organization_id) {
    throw new Error('No workspace')
  }
  return profile.organization_id
}

export function hasOrgId(profile: Pick<Profile, 'organization_id'>): profile is Pick<Profile, 'organization_id'> & { organization_id: string } {
  return Boolean(profile.organization_id)
}

/** Filter a PostgREST query to the signed-in workspace. */
export function eqOrg<T extends { eq: (column: string, value: string) => T }>(
  query: T,
  orgId: string | null | undefined,
): T {
  if (!orgId) {
    throw new Error('No workspace')
  }
  return query.eq('organization_id', orgId)
}
