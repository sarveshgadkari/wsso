export type { Database } from './database'
import type { Database } from './database'

// ── Table row types ───────────────────────────────────────────────────────────
// Use these throughout the app instead of the verbose Database['public']['Tables']…
type Tables = Database['public']['Tables']

export type Profile          = Tables['profiles']['Row']
export type Company          = Tables['companies']['Row']
export type Team             = Tables['teams']['Row']
export type EmployeeCompany  = Tables['employee_companies']['Row']
export type Client           = Tables['clients']['Row']
export type Project          = Tables['projects']['Row']
export type Tactic           = Tables['tactics']['Row']
export type ActivityLog      = Tables['activity_logs']['Row']
export type TimeLog          = Tables['time_logs']['Row']
export type Document         = Tables['documents']['Row']
export type Notification     = Tables['notifications']['Row']
export type TacticDocument   = Tables['tactic_documents']['Row']
export type TacticTask       = Tables['tactic_tasks']['Row']
export type TacticNextStep   = Tables['tactic_next_steps']['Row']

// Insert shapes (id/created_at optional)
export type InsertProfile         = Tables['profiles']['Insert']
export type InsertCompany         = Tables['companies']['Insert']
export type InsertTeam            = Tables['teams']['Insert']
export type InsertEmployeeCompany = Tables['employee_companies']['Insert']
export type InsertClient          = Tables['clients']['Insert']
export type InsertProject         = Tables['projects']['Insert']
export type InsertTactic          = Tables['tactics']['Insert']
export type InsertActivityLog     = Tables['activity_logs']['Insert']
export type InsertTimeLog         = Tables['time_logs']['Insert']
export type InsertDocument        = Tables['documents']['Insert']
export type InsertNotification    = Tables['notifications']['Insert']
export type InsertTacticDocument  = Tables['tactic_documents']['Insert']
export type InsertTacticTask      = Tables['tactic_tasks']['Insert']
export type InsertTacticNextStep  = Tables['tactic_next_steps']['Insert']

// Update shapes (everything optional)
export type UpdateProfile         = Tables['profiles']['Update']
export type UpdateTactic          = Tables['tactics']['Update']
export type UpdateTimeLog         = Tables['time_logs']['Update']
export type UpdateProject         = Tables['projects']['Update']
export type UpdateNotification    = Tables['notifications']['Update']
export type UpdateTacticDocument  = Tables['tactic_documents']['Update']
export type UpdateTacticTask      = Tables['tactic_tasks']['Update']
export type UpdateTacticNextStep  = Tables['tactic_next_steps']['Update']

// ── Enum types ────────────────────────────────────────────────────────────────
type Enums = Database['public']['Enums']

export type UserRole         = Enums['user_role']
export type ProfileStatus    = Enums['profile_status']
export type ProjectStatus    = Enums['project_status']
export type TacticPriority   = Enums['tactic_priority']
export type TacticStatus     = Enums['tactic_status']
export type ClientStatus     = Enums['client_status']
export type ClockCloseReason = Enums['clock_close_reason']

// ── Const arrays for UI (select dropdowns, filter chips, etc.) ────────────────
export const USER_ROLES    = ['admin', 'director', 'manager', 'employee']  as const satisfies UserRole[]
export const TACTIC_STATUSES = ['assigned', 'in_progress', 'review', 'done', 'archived'] as const satisfies TacticStatus[]
export const TACTIC_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const satisfies TacticPriority[]
export const PROJECT_STATUSES  = ['active', 'on_hold', 'completed']    as const satisfies ProjectStatus[]
