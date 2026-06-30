import { getProfile } from '@/lib/auth/session'
import type { UserRole } from '@/lib/types'

interface RoleGuardProps {
  /** Roles that are allowed to see the children */
  allow: UserRole[]
  children: React.ReactNode
  /** What to render for disallowed roles. Defaults to nothing. */
  fallback?: React.ReactNode
}

/**
 * Server Component — fetches the current user's profile and renders children
 * only when their role is in the `allow` list.
 *
 * This is a second layer of defense on top of middleware route protection.
 * Use it to hide page sections (e.g., admin action buttons) that non-admins
 * shouldn't see, rather than relying solely on the middleware to block URLs.
 *
 * Example:
 *   <RoleGuard allow={['admin']}>
 *     <DeleteButton />
 *   </RoleGuard>
 */
export async function RoleGuard({ allow, children, fallback = null }: RoleGuardProps) {
  const profile = await getProfile()

  if (!profile || !allow.includes(profile.role)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}
