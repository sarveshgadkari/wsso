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
  Table2,
  Megaphone,
  Handshake,
  UserCheck,
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
      { label: 'My Work',      href: '/my-work', icon: Table2 },
      { label: 'TACTICs',      href: '/tactic-documents', icon: FileText },
      { label: 'Work Orders',  href: '/tactics', icon: ClipboardList },
      { label: 'Kanban Board', href: '/kanban',  icon: Kanban },
    ],
  },
  {
    title: 'Organization',
    items: [
      { label: 'Employees', href: '/employees', icon: Users,     roles: ['admin', 'manager'] },
      { label: 'Companies', href: '/companies', icon: Building2, roles: ['admin'] },
      { label: 'Projects',  href: '/projects',  icon: FolderOpen, roles: ['admin', 'manager'] },
      { label: 'Clients',   href: '/clients',   icon: Briefcase,  roles: ['admin', 'manager'] },
    ],
  },
  {
    title: 'CRM',
    items: [
      { label: 'CRM',       href: '/crm',      icon: Handshake, roles: ['admin'] },
      { label: 'My Leads',  href: '/my-leads', icon: UserCheck },
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
      { label: 'Documents',      href: '/documents',      icon: FileText },
      { label: 'Announcements',  href: '/announcements',  icon: Megaphone },
      { label: 'Reports',        href: '/reports',        icon: BarChart3,  roles: ['admin', 'manager'] },
      { label: 'Activity Log',   href: '/activity-log',   icon: Activity },
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
  '/my-work',
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
  '/announcements',
  '/notifications',
  '/settings',
  '/crm',
  '/my-leads',
]

/** Paths accessible only to admin/manager in the middleware */
export const MANAGER_ADMIN_PATHS = ['/employees', '/time/team', '/projects', '/clients', '/reports']

/** Paths accessible only to admin in the middleware */
export const ADMIN_ONLY_PATHS = ['/companies', '/settings', '/api/admin', '/crm']
