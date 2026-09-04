'use client'

import { usePathname } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
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
  ['/training',           'Training'],
  ['/documents',          'Documents'],
  ['/reports',            'Reports'],
  ['/activity-log',       'Activity Log'],
  ['/announcements',      'Announcements'],
  ['/notifications',      'Notifications'],
  ['/settings/workspace', 'Workspace settings'],
  ['/settings/hierarchy', 'Workspace settings'],
  ['/settings/billing',   'Subscription'],
  ['/sticky-notes',       'Sticky Notes'],
  ['/approvals',          'Approvals'],
  ['/compliance',         'Licenses'],
  ['/platform/payments',  'Payments'],
  ['/platform/plans',     'Plans'],
  ['/platform',           'Platform'],
  ['/connect-ai',         'Connect AI'],
]

const ROLE_CHIP: Record<string, string> = {
  super_admin: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  admin:    'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  director: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300',
  manager:  'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-200',
  employee: 'bg-neutral-100 text-neutral-600',
}

interface TopbarProps {
  profile: Profile
  notifCount: number
  hideNotifications?: boolean
}

export function Topbar({ profile, notifCount, hideNotifications = false }: TopbarProps) {
  const pathname = usePathname()

  // Longest-prefix match for page title
  const pageTitle =
    PAGE_TITLES.find(([path]) => pathname === path || pathname.startsWith(path + '/'))?.[1] ??
    'WSSO'

  const firstName = (profile?.full_name ?? 'User').split(' ')[0]

  return (
    <header data-topbar className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6">
      {/* Page title */}
      <h1 className="text-base font-semibold text-neutral-900">{pageTitle}</h1>

      {/* Right-side actions */}
      <div className="flex items-center gap-5">
        <ThemeToggle />

        {/* Notifications bell — live dropdown + Realtime (workspace users only) */}
        {profile.role !== 'super_admin' && !hideNotifications && (
          <NotificationBell initialCount={notifCount} userId={profile.id} />
        )}

        {/* User identity */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-800">{firstName}</span>
          {profile.role === 'super_admin' ? (
            <a
              href="/platform"
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                ROLE_CHIP.super_admin,
              )}
            >
              Super Admin
            </a>
          ) : (
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize',
                ROLE_CHIP[profile.role] ?? ROLE_CHIP.employee,
              )}
            >
              {profile.role}
            </span>
          )}
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
