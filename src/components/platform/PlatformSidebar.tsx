'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CreditCard, Tags } from 'lucide-react'
import { cn } from '@/lib/utils'

const ITEMS = [
  { label: 'Workspaces', href: '/platform', icon: LayoutDashboard },
  { label: 'Plans', href: '/platform/plans', icon: Tags },
  { label: 'Payments', href: '/platform/payments', icon: CreditCard },
]

export function PlatformSidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-neutral-200 bg-white">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-neutral-200 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 shadow-sm">
          <span className="text-xs font-bold text-white">W</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-neutral-900 tracking-tight">WSSO</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-primary-600">Platform</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Platform">
        {ITEMS.map((item) => {
          const isActive =
            item.href === '/platform'
              ? pathname === '/platform' || pathname.startsWith('/platform/organizations')
              : pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700 font-medium'
                  : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
              )}
            >
              <item.icon className={cn('h-4 w-4', isActive ? 'text-primary-600' : 'text-neutral-400')} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="shrink-0 border-t border-neutral-200 px-4 py-3">
        <p className="text-[10px] text-neutral-400">Super Admin</p>
      </div>
    </aside>
  )
}
