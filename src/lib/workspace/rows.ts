import type { CatalogKind, CustomFieldEntity, CustomFieldType } from './settings'

export type OrgLocation = {
  id: string
  organization_id: string
  name: string
  address: string | null
  timezone: string | null
  is_active: boolean
  created_at: string
}

export type OrgHoliday = {
  id: string
  organization_id: string
  name: string
  holiday_on: string
  is_paid: boolean
  created_at: string
}

export type OrgCatalogItem = {
  id: string
  organization_id: string
  kind: CatalogKind
  slug: string
  label: string
  color: string | null
  meta: Record<string, unknown>
  sort_order: number
  is_active: boolean
  created_at: string
}

export type CustomFieldDefinition = {
  id: string
  organization_id: string
  entity_type: CustomFieldEntity
  field_key: string
  label: string
  field_type: CustomFieldType
  options: { value: string; label: string }[]
  required: boolean
  sort_order: number
  is_active: boolean
}

export type CustomFieldValue = {
  id: string
  definition_id: string
  entity_id: string
  value_text: string | null
}

export type ChecklistTemplate = {
  id: string
  organization_id: string
  name: string
  is_active: boolean
  created_at: string
  items?: ChecklistTemplateItem[]
}

export type ChecklistTemplateItem = {
  id: string
  template_id: string
  label: string
  required: boolean
  sort_order: number
}

export type TacticChecklistItem = {
  id: string
  tactic_id: string
  label: string
  required: boolean
  sort_order: number
  completed: boolean
  completed_by: string | null
  completed_at: string | null
}

export type LeadFollowUp = {
  id: string
  lead_id: string
  due_on: string
  note: string | null
  assigned_to: string | null
  completed_at: string | null
  created_by: string
  created_at: string
}

export type ComplianceRecord = {
  id: string
  profile_id: string | null
  client_id: string | null
  type_id: string | null
  title: string
  expires_on: string | null
  notes: string | null
  created_at: string
}

export type RecurringJob = {
  id: string
  title: string
  description: string | null
  project_id: string | null
  assigned_to: string | null
  checklist_template_id: string | null
  work_order_type_id: string | null
  priority: 'low' | 'medium' | 'high' | 'critical'
  estimated_hours: number | null
  frequency: 'daily' | 'weekly' | 'monthly'
  interval_n: number
  next_run_on: string
  last_run_on: string | null
  is_active: boolean
}
