import { SidebarNavLinks } from './SidebarNavLinks'
import { BrandLogo } from '@/components/brand/BrandLogo'
import type { UserRole } from '@/lib/types'

interface SidebarProps {
  role: UserRole
  notifCount: number
  subscriptionLocked?: boolean
}

// Server Component — no client-side hooks.
// SidebarNavLinks (client) handles usePathname() for active highlighting.
export function Sidebar({ role, notifCount, subscriptionLocked = false }: SidebarProps) {
  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-neutral-200 bg-white">
      {/* Brand */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-neutral-200 px-3">
        <BrandLogo size={48} href="/dashboard" />
      </div>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto py-3">
        <SidebarNavLinks role={role} notifCount={notifCount} subscriptionLocked={subscriptionLocked} />
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-neutral-200 px-4 py-3">
        <p className="text-[10px] text-neutral-400">v0.1 · alpha</p>
      </div>
    </aside>
  )
}
