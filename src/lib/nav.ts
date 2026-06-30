import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  ClipboardList,
  Kanban,
  Users,
  Building2,
  FolderOpen,
  Briefcase,
  Clock,
  CalendarClock,
  FileText,
  BarChart3,
  Activity,
  Bell,
  Settings,
} from 'lucide-react'
import type { UserRole } from '@/lib/types'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** If set, only these roles see the item (undefined = all roles) */
  roles?: UserRole[]
  /** Mark true to render the notifications badge */
  isNotifications?: boolean
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Work',
    items: [
      { label: 'Tactics',      href: '/tactics', icon: ClipboardList },
      { label: 'Kanban Board', href: '/kanban',  icon: Kanban },
    ],
  },
  {
    title: 'Organization',
    items: [
      { label: 'Employees', href: '/employees', icon: Users,     roles: ['admin', 'manager'] },
      { label: 'Companies', href: '/companies', icon: Building2, roles: ['admin'] },
      { label: 'Projects',  href: '/projects',  icon: FolderOpen },
      { label: 'Clients',   href: '/clients',   icon: Briefcase },
    ],
  },
  {
    title: 'Time',
    items: [
      { label: 'My Time',   href: '/time',      icon: Clock },
      { label: 'Team Time', href: '/time/team', icon: CalendarClock, roles: ['admin', 'manager'] },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Documents',    href: '/documents',    icon: FileText },
      { label: 'Reports',      href: '/reports',      icon: BarChart3 },
      { label: 'Activity Log', href: '/activity-log', icon: Activity },
    ],
  },
  {
    items: [
      { label: 'Notifications', href: '/notifications',      icon: Bell,     isNotifications: true },
      { label: 'Admin Settings',href: '/settings/hierarchy', icon: Settings, roles: ['admin'] },
    ],
  },
]

/** All paths that require authentication (used by middleware) */
export const DASHBOARD_PATHS = [
  '/dashboard',
  '/tactics',
  '/kanban',
  '/employees',
  '/companies',
  '/projects',
  '/clients',
  '/time',
  '/documents',
  '/reports',
  '/activity-log',
  '/notifications',
  '/settings',
]

/** Paths accessible only to admin/manager in the middleware */
export const MANAGER_ADMIN_PATHS = ['/employees', '/time/team']

/** Paths accessible only to admin in the middleware */
export const ADMIN_ONLY_PATHS = ['/companies', '/settings', '/api/admin']
