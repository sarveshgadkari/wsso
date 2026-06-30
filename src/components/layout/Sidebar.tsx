import { SidebarNavLinks } from './SidebarNavLinks'
import type { UserRole } from '@/lib/types'

interface SidebarProps {
  role: UserRole
  notifCount: number
}

// Server Component — no client-side hooks.
// SidebarNavLinks (client) handles usePathname() for active highlighting.
export function Sidebar({ role, notifCount }: SidebarProps) {
  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-neutral-200 bg-white">
      {/* Brand */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-neutral-200 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 shadow-sm">
          <span className="text-xs font-bold text-white">W</span>
        </div>
        <span className="text-sm font-semibold text-neutral-900 tracking-tight">WSSO</span>
      </div>

      {/* Scrollable nav */}
      <div className="flex-1 overflow-y-auto py-3">
        <SidebarNavLinks role={role} notifCount={notifCount} />
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-neutral-200 px-4 py-3">
        <p className="text-[10px] text-neutral-400">v0.1 · alpha</p>
      </div>
    </aside>
  )
}
