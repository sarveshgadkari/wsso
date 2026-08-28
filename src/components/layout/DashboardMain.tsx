'use client'

import { usePathname } from 'next/navigation'
import { WorkspaceLock } from '@/components/billing/WorkspaceLock'
import type { UserRole } from '@/lib/types'

export function DashboardMain({
  locked,
  role,
  children,
}: {
  locked: boolean
  role: UserRole
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const billingOpen = pathname === '/settings/billing' || pathname.startsWith('/settings/billing?')

  if (locked && !(role === 'admin' && billingOpen)) {
    return <WorkspaceLock role={role} />
  }

  return <>{children}</>
}
