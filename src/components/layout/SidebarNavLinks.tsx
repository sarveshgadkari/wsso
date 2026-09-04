'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { NAV_SECTIONS } from '@/lib/nav'
import type { UserRole } from '@/lib/types'
import type { WorkspaceFeatures } from '@/lib/workspace/settings'
import { DEFAULT_WORKSPACE_FEATURES } from '@/lib/workspace/settings'

interface SidebarNavLinksProps {
  role: UserRole
  notifCount: number
  subscriptionLocked?: boolean
  features?: WorkspaceFeatures
}

export function SidebarNavLinks({ role, notifCount, subscriptionLocked = false, features }: SidebarNavLinksProps) {
  const pathname = usePathname()
  const flags = features ?? DEFAULT_WORKSPACE_FEATURES

  return (
    <nav className="flex flex-col gap-1 px-3" aria-label="Main navigation">
      {NAV_SECTIONS.map((section, si) => {
        const visible = section.items.filter((item) => {
          if (item.roles && !item.roles.includes(role)) return false
          if (item.feature && !flags[item.feature]) return false
          if (subscriptionLocked) {
            return item.href === '/dashboard' || item.href === '/settings/billing'
          }
          return true
        })
        if (visible.length === 0) return null

        return (
          <div key={si} className={si > 0 ? 'mt-5' : ''}>
            {section.title && (
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                {section.title}
              </p>
            )}

            {visible.map((item) => {
              // Exact match for dashboard, prefix match for everything else
              const isActive =
                item.href === '/dashboard'
                  ? pathname === '/dashboard'
                  : pathname === item.href || pathname.startsWith(item.href + '/')

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700 font-medium dark:bg-primary-500/20 dark:text-primary-200'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                  )}
                >
                  <item.icon
                    className={cn(
                      'h-4 w-4 shrink-0 transition-colors',
                      isActive
                        ? 'text-primary-600'
                        : 'text-neutral-400 group-hover:text-neutral-600',
                    )}
                  />

                  <span className="flex-1 truncate">{item.label}</span>

                  {/* Notification badge */}
                  {item.isNotifications && notifCount > 0 && (
                    <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white leading-none">
                      {notifCount > 99 ? '99+' : notifCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )
      })}
    </nav>
  )
}
