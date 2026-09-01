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
  CalendarOff,
  CalendarCheck,
  GraduationCap,
  Bot,
  CreditCard,
  Inbox,
  ShieldCheck,
} from 'lucide-react'
import type { UserRole } from '@/lib/types'
import type { WorkspaceFeatureKey } from '@/lib/workspace/settings'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** If set, only these roles see the item (undefined = all roles) */
  roles?: UserRole[]
  /** Mark true to render the notifications badge */
  isNotifications?: boolean
  /** Hide when this workspace feature is turned off */
  feature?: WorkspaceFeatureKey
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
      { label: 'My Work',      href: '/my-work', icon: Table2, feature: 'myWork' },
      { label: 'TACTICs',      href: '/tactic-documents', icon: FileText },
      { label: 'Work Orders',  href: '/tactics', icon: ClipboardList },
      { label: 'Kanban Board', href: '/kanban',  icon: Kanban, feature: 'kanban' },
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
      { label: 'CRM',       href: '/crm',      icon: Handshake, roles: ['admin'], feature: 'crm' },
      { label: 'My Leads',  href: '/my-leads', icon: UserCheck, feature: 'crm' },
    ],
  },
  {
    title: 'Time',
    items: [
      { label: 'My Time',   href: '/time',      icon: Clock, feature: 'time' },
      { label: 'Team Time', href: '/time/team', icon: CalendarClock, roles: ['admin', 'manager'], feature: 'time' },
      { label: 'My Leave',   href: '/leave',      icon: CalendarOff, feature: 'leave' },
      { label: 'Team Leave', href: '/leave/team', icon: CalendarCheck, roles: ['admin', 'manager'], feature: 'leave' },
      { label: 'Approvals', href: '/approvals', icon: Inbox, roles: ['admin', 'manager'], feature: 'approvals' },
    ],
  },
  {
    title: 'Content',
    items: [
      { label: 'Training',       href: '/training',       icon: GraduationCap, feature: 'training' },
      { label: 'Documents',      href: '/documents',      icon: FileText, feature: 'documents' },
      { label: 'Announcements',  href: '/announcements',  icon: Megaphone, feature: 'announcements' },
      { label: 'Licenses',       href: '/compliance',     icon: ShieldCheck, roles: ['admin', 'manager'], feature: 'compliance' },
      { label: 'Reports',        href: '/reports',        icon: BarChart3,  roles: ['admin', 'manager'] },
      { label: 'Activity Log',   href: '/activity-log',   icon: Activity },
    ],
  },
  {
    items: [
      { label: 'Connect AI',     href: '/connect-ai',         icon: Bot, feature: 'connectAi' },
      { label: 'Notifications', href: '/notifications',      icon: Bell,     isNotifications: true },
      { label: 'Subscription', href: '/settings/billing',   icon: CreditCard, roles: ['admin'] },
      { label: 'Workspace',    href: '/settings/workspace', icon: Settings, roles: ['admin'] },
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
  '/training',
  '/documents',
  '/reports',
  '/activity-log',
  '/announcements',
  '/notifications',
  '/settings',
  '/crm',
  '/my-leads',
  '/leave',
  '/connect-ai',
  '/approvals',
  '/compliance',
]

/** Paths accessible only to admin/manager in the middleware */
export const MANAGER_ADMIN_PATHS = ['/employees', '/time/team', '/leave/team', '/projects', '/clients', '/reports', '/approvals', '/compliance']

/** Paths accessible only to admin in the middleware */
export const ADMIN_ONLY_PATHS = ['/companies', '/settings', '/api/admin', '/crm']

export const PLATFORM_NAV: NavSection[] = [
  {
    items: [
      { label: 'Workspaces', href: '/platform', icon: LayoutDashboard },
    ],
  },
]
