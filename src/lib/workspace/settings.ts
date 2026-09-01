export type WorkspaceFeatureKey =
  | 'crm'
  | 'training'
  | 'time'
  | 'leave'
  | 'kanban'
  | 'connectAi'
  | 'myWork'
  | 'documents'
  | 'announcements'
  | 'jobCosting'
  | 'whoIsWorking'
  | 'approvals'
  | 'customFields'
  | 'checklists'
  | 'compliance'
  | 'followUps'
  | 'recurringJobs'

export type WorkspaceFeatures = Record<WorkspaceFeatureKey, boolean>

export type WorkspaceSettings = {
  features: WorkspaceFeatures
  time: {
    overtimeWeeklyMinutes: number
    requireClockInNote: boolean
    requireClockOutNote: boolean
    workWeekStartsOn: 0 | 1
    targetDailyMinutes: number
  }
  workOrders: {
    defaultSlaHours: number | null
    requireChecklistOnCreate: boolean
    defaultBillable: boolean
  }
  crm: {
    requireFollowUpOnStatusChange: boolean
    defaultFollowUpDays: number
  }
  leave: {
    requireType: boolean
  }
}

export const DEFAULT_WORKSPACE_FEATURES: WorkspaceFeatures = {
  crm: true,
  training: true,
  time: true,
  leave: true,
  kanban: true,
  connectAi: true,
  myWork: true,
  documents: true,
  announcements: true,
  jobCosting: true,
  whoIsWorking: true,
  approvals: true,
  customFields: true,
  checklists: true,
  compliance: true,
  followUps: true,
  recurringJobs: true,
}

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  features: { ...DEFAULT_WORKSPACE_FEATURES },
  time: {
    overtimeWeeklyMinutes: 40 * 60,
    requireClockInNote: false,
    requireClockOutNote: false,
    workWeekStartsOn: 1,
    targetDailyMinutes: 8 * 60,
  },
  workOrders: {
    defaultSlaHours: null,
    requireChecklistOnCreate: false,
    defaultBillable: true,
  },
  crm: {
    requireFollowUpOnStatusChange: false,
    defaultFollowUpDays: 3,
  },
  leave: {
    requireType: true,
  },
}

export const FEATURE_LABELS: { key: WorkspaceFeatureKey; label: string; hint: string }[] = [
  { key: 'time', label: 'Time clock', hint: 'Clock in/out and timesheets' },
  { key: 'leave', label: 'Leave', hint: 'Time-off requests and approvals' },
  { key: 'approvals', label: 'Approvals inbox', hint: 'One list for leave and clock notes' },
  { key: 'whoIsWorking', label: 'Who is working', hint: 'Live clocked-in board' },
  { key: 'jobCosting', label: 'Job costing', hint: 'Hours × rate on work orders' },
  { key: 'crm', label: 'CRM', hint: 'Leads, convert to client, pipeline' },
  { key: 'followUps', label: 'Lead follow-ups', hint: 'Next-action dates on leads' },
  { key: 'checklists', label: 'Job checklists', hint: 'Reusable checklists on work orders' },
  { key: 'recurringJobs', label: 'Recurring jobs', hint: 'Auto-create repeating work orders' },
  { key: 'compliance', label: 'Licenses & expiry', hint: 'Contracts, certs, insurance dates' },
  { key: 'customFields', label: 'Custom fields', hint: 'Extra fields on people, clients, jobs' },
  { key: 'kanban', label: 'Kanban', hint: 'Board view of work orders' },
  { key: 'myWork', label: 'My Work', hint: 'Personal work sheets' },
  { key: 'training', label: 'Training', hint: 'Modules, quizzes, certificates' },
  { key: 'documents', label: 'Documents', hint: 'Shared files' },
  { key: 'announcements', label: 'Announcements', hint: 'Company posts' },
  { key: 'connectAi', label: 'Connect AI', hint: 'MCP / AI assistant' },
]

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

export function mergeWorkspaceSettings(raw: unknown): WorkspaceSettings {
  const r = asRecord(raw)
  const featuresIn = asRecord(r.features)
  const timeIn = asRecord(r.time)
  const woIn = asRecord(r.workOrders)
  const crmIn = asRecord(r.crm)
  const leaveIn = asRecord(r.leave)

  const features = { ...DEFAULT_WORKSPACE_FEATURES }
  ;(Object.keys(features) as WorkspaceFeatureKey[]).forEach((k) => {
    features[k] = bool(featuresIn[k], features[k])
  })

  const weekStart = timeIn.workWeekStartsOn === 0 || timeIn.workWeekStartsOn === 1
    ? timeIn.workWeekStartsOn
    : DEFAULT_WORKSPACE_SETTINGS.time.workWeekStartsOn

  return {
    features,
    time: {
      overtimeWeeklyMinutes: Math.max(1, num(timeIn.overtimeWeeklyMinutes, DEFAULT_WORKSPACE_SETTINGS.time.overtimeWeeklyMinutes)),
      requireClockInNote: bool(timeIn.requireClockInNote, false),
      requireClockOutNote: bool(timeIn.requireClockOutNote, false),
      workWeekStartsOn: weekStart,
      targetDailyMinutes: Math.max(1, num(timeIn.targetDailyMinutes, DEFAULT_WORKSPACE_SETTINGS.time.targetDailyMinutes)),
    },
    workOrders: {
      defaultSlaHours:
        timeIn.defaultSlaHours === null || woIn.defaultSlaHours === null
          ? null
          : typeof woIn.defaultSlaHours === 'number'
            ? woIn.defaultSlaHours
            : DEFAULT_WORKSPACE_SETTINGS.workOrders.defaultSlaHours,
      requireChecklistOnCreate: bool(woIn.requireChecklistOnCreate, false),
      defaultBillable: bool(woIn.defaultBillable, true),
    },
    crm: {
      requireFollowUpOnStatusChange: bool(crmIn.requireFollowUpOnStatusChange, false),
      defaultFollowUpDays: Math.max(1, num(crmIn.defaultFollowUpDays, 3)),
    },
    leave: {
      requireType: bool(leaveIn.requireType, true),
    },
  }
}

export type CatalogKind =
  | 'leave_type'
  | 'win_reason'
  | 'lost_reason'
  | 'skill'
  | 'compliance_type'
  | 'work_order_type'

export const CATALOG_KINDS: { kind: CatalogKind; label: string; hint: string }[] = [
  { kind: 'leave_type', label: 'Leave types', hint: 'Vacation, sick, unpaid — used on leave requests' },
  { kind: 'win_reason', label: 'Win reasons', hint: 'Why a lead converted' },
  { kind: 'lost_reason', label: 'Lost reasons', hint: 'Why a lead was lost' },
  { kind: 'skill', label: 'Skills', hint: 'Assign to employees, then match jobs' },
  { kind: 'compliance_type', label: 'License / cert types', hint: 'Driver license, insurance, contracts' },
  { kind: 'work_order_type', label: 'Job types', hint: 'Standard, inspection, emergency, …' },
]

export type CustomFieldEntity = 'employee' | 'client' | 'lead' | 'work_order' | 'project'
export type CustomFieldType = 'text' | 'number' | 'date' | 'select' | 'boolean'

export const CUSTOM_FIELD_ENTITIES: { type: CustomFieldEntity; label: string }[] = [
  { type: 'employee', label: 'Employees' },
  { type: 'client', label: 'Clients' },
  { type: 'lead', label: 'Leads' },
  { type: 'work_order', label: 'Work orders' },
  { type: 'project', label: 'Projects' },
]
