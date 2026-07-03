'use client'

import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import type { Profile } from '@/lib/types'

// Map route paths to human-readable page titles.
// Longer prefixes must appear first after sorting so they win over shorter ones.
const PAGE_TITLES: [string, string][] = [
  ['/dashboard',          'Dashboard'],
  ['/tactics',            'Tactics'],
  ['/kanban',             'Kanban Board'],
  ['/employees',          'Employees'],
  ['/companies',          'Companies'],
  ['/projects',           'Projects'],
  ['/clients',            'Clients'],
  ['/time/team',          'Team Time'],
  ['/time',               'My Time'],
  ['/documents',          'Documents'],
  ['/reports',            'Reports'],
  ['/activity-log',       'Activity Log'],
  ['/announcements',      'Announcements'],
  ['/notifications',      'Notifications'],
  ['/settings/hierarchy', 'Admin Settings'],
]

const ROLE_CHIP: Record<string, string> = {
  admin:    'bg-rose-100    text-rose-700',
  director: 'bg-purple-100  text-purple-700',
  manager:  'bg-primary-100 text-primary-700',
  employee: 'bg-neutral-100 text-neutral-600',
}

interface TopbarProps {
  profile: Profile
  notifCount: number
}

export function Topbar({ profile, notifCount }: TopbarProps) {
  const pathname = usePathname()

  // Longest-prefix match for page title
  const pageTitle =
    PAGE_TITLES.find(([path]) => pathname === path || pathname.startsWith(path + '/'))?.[1] ??
    'WSSO'

  const firstName = (profile?.full_name ?? 'User').split(' ')[0]

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6">
      {/* Page title */}
      <h1 className="text-base font-semibold text-neutral-900">{pageTitle}</h1>

      {/* Right-side actions */}
      <div className="flex items-center gap-5">
        {/* Notifications bell — live dropdown + Realtime */}
        <NotificationBell initialCount={notifCount} userId={profile.id} />

        {/* User identity */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-800">{firstName}</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize',
              ROLE_CHIP[profile.role] ?? ROLE_CHIP.employee,
            )}
          >
            {profile.role}
          </span>
        </div>

        {/* Sign out */}
        <form action="/auth/signout" method="POST">
          <button
            type="submit"
            aria-label="Sign out"
            className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-600 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden text-xs sm:inline">Sign out</span>
          </button>
        </form>
      </div>
    </header>
  )
}
