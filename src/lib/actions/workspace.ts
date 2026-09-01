'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireProfile, requireRole } from '@/lib/auth/session'
import { ops } from '@/lib/workspace/db'
import {
  mergeWorkspaceSettings,
  type CatalogKind,
  type CustomFieldEntity,
  type CustomFieldType,
  type WorkspaceSettings,
} from '@/lib/workspace/settings'
import type {
  ChecklistTemplate,
  CustomFieldDefinition,
  OrgCatalogItem,
  OrgHoliday,
  OrgLocation,
} from '@/lib/workspace/rows'

function revalidateWorkspace() {
  revalidatePath('/settings/workspace')
  revalidatePath('/settings/hierarchy')
  revalidatePath('/dashboard')
  revalidatePath('/approvals')
  revalidatePath('/leave')
  revalidatePath('/crm')
  revalidatePath('/tactics')
  revalidatePath('/compliance')
  revalidatePath('/time/team')
}

export async function getWorkspaceSettings(): Promise<WorkspaceSettings> {
  const profile = await requireProfile()
  if (!profile.organization_id) return mergeWorkspaceSettings({})
  const { data } = await supabaseAdmin
    .from('organizations')
    .select('settings')
    .eq('id', profile.organization_id)
    .maybeSingle()
  return mergeWorkspaceSettings(data?.settings)
}

export async function saveWorkspaceSettings(partial: Partial<WorkspaceSettings>) {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) return { error: 'No workspace' }

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('settings')
    .eq('id', profile.organization_id)
    .single()

  const merged = mergeWorkspaceSettings({
    ...mergeWorkspaceSettings(org?.settings),
    ...partial,
    features: { ...mergeWorkspaceSettings(org?.settings).features, ...(partial.features ?? {}) },
    time: { ...mergeWorkspaceSettings(org?.settings).time, ...(partial.time ?? {}) },
    workOrders: { ...mergeWorkspaceSettings(org?.settings).workOrders, ...(partial.workOrders ?? {}) },
    crm: { ...mergeWorkspaceSettings(org?.settings).crm, ...(partial.crm ?? {}) },
    leave: { ...mergeWorkspaceSettings(org?.settings).leave, ...(partial.leave ?? {}) },
  })

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({ settings: merged as unknown as Record<string, unknown> })
    .eq('id', profile.organization_id)

  if (error) return { error: error.message }
  revalidateWorkspace()
  return { data: merged }
}

export async function listCatalog(kind: CatalogKind, activeOnly = false): Promise<OrgCatalogItem[]> {
  const profile = await requireProfile()
  if (!profile.organization_id) return []
  let q = ops(supabaseAdmin, 'org_catalog_items')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('kind', kind)
    .order('sort_order')
    .order('label')
  if (activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) return []
  return (data ?? []) as OrgCatalogItem[]
}

const catalogSchema = z.object({
  kind: z.enum(['leave_type', 'win_reason', 'lost_reason', 'skill', 'compliance_type', 'work_order_type']),
  label: z.string().trim().min(1).max(80),
  color: z.string().max(20).optional().nullable(),
  paid: z.boolean().optional(),
  id: z.string().uuid().optional(),
})

function slugifyLabel(label: string) {
  return label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40) || 'item'
}

export async function saveCatalogItem(input: z.infer<typeof catalogSchema>) {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) return { error: 'No workspace' }
  const parsed = catalogSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid input' }

  const meta = parsed.data.kind === 'leave_type' ? { paid: parsed.data.paid !== false } : {}
  const slug = slugifyLabel(parsed.data.label)

  if (parsed.data.id) {
    const { error } = await ops(supabaseAdmin, 'org_catalog_items')
      .update({ label: parsed.data.label, color: parsed.data.color ?? null, meta })
      .eq('id', parsed.data.id)
      .eq('organization_id', profile.organization_id)
    if (error) return { error: error.message }
  } else {
    const { error } = await ops(supabaseAdmin, 'org_catalog_items').insert({
      organization_id: profile.organization_id,
      kind: parsed.data.kind,
      slug: `${slug}_${Date.now().toString(36).slice(-4)}`,
      label: parsed.data.label,
      color: parsed.data.color ?? null,
      meta,
      sort_order: 100,
    })
    if (error) return { error: error.message }
  }
  revalidateWorkspace()
  return { ok: true }
}

export async function setCatalogItemActive(id: string, is_active: boolean) {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) return { error: 'No workspace' }
  const { error } = await ops(supabaseAdmin, 'org_catalog_items')
    .update({ is_active })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
  if (error) return { error: error.message }
  revalidateWorkspace()
  return { ok: true }
}

export async function listLocations(activeOnly = false): Promise<OrgLocation[]> {
  const profile = await requireProfile()
  if (!profile.organization_id) return []
  let q = ops(supabaseAdmin, 'org_locations')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('name')
  if (activeOnly) q = q.eq('is_active', true)
  const { data, error } = await q
  if (error) return []
  return (data ?? []) as OrgLocation[]
}

export async function saveLocation(input: { id?: string; name: string; address?: string; timezone?: string }) {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) return { error: 'No workspace' }
  const name = input.name.trim()
  if (!name) return { error: 'Name is required' }

  if (input.id) {
    const { error } = await ops(supabaseAdmin, 'org_locations')
      .update({ name, address: input.address?.trim() || null, timezone: input.timezone?.trim() || null })
      .eq('id', input.id)
      .eq('organization_id', profile.organization_id)
    if (error) return { error: error.message }
  } else {
    const { error } = await ops(supabaseAdmin, 'org_locations').insert({
      organization_id: profile.organization_id,
      name,
      address: input.address?.trim() || null,
      timezone: input.timezone?.trim() || null,
    })
    if (error) return { error: error.message }
  }
  revalidateWorkspace()
  return { ok: true }
}

export async function setLocationActive(id: string, is_active: boolean) {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) return { error: 'No workspace' }
  const { error } = await ops(supabaseAdmin, 'org_locations')
    .update({ is_active })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
  if (error) return { error: error.message }
  revalidateWorkspace()
  return { ok: true }
}

export async function listHolidays(): Promise<OrgHoliday[]> {
  const profile = await requireProfile()
  if (!profile.organization_id) return []
  const { data, error } = await ops(supabaseAdmin, 'org_holidays')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('holiday_on')
  if (error) return []
  return (data ?? []) as OrgHoliday[]
}

export async function saveHoliday(input: { id?: string; name: string; holiday_on: string; is_paid: boolean }) {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) return { error: 'No workspace' }
  if (!input.name.trim() || !input.holiday_on) return { error: 'Name and date are required' }

  if (input.id) {
    const { error } = await ops(supabaseAdmin, 'org_holidays')
      .update({ name: input.name.trim(), holiday_on: input.holiday_on, is_paid: input.is_paid })
      .eq('id', input.id)
      .eq('organization_id', profile.organization_id)
    if (error) return { error: error.message }
  } else {
    const { error } = await ops(supabaseAdmin, 'org_holidays').insert({
      organization_id: profile.organization_id,
      name: input.name.trim(),
      holiday_on: input.holiday_on,
      is_paid: input.is_paid,
    })
    if (error) return { error: error.message }
  }
  revalidateWorkspace()
  return { ok: true }
}

export async function deleteHoliday(id: string) {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) return { error: 'No workspace' }
  const { error } = await ops(supabaseAdmin, 'org_holidays')
    .delete()
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
  if (error) return { error: error.message }
  revalidateWorkspace()
  return { ok: true }
}

export async function listFieldDefinitions(entity?: CustomFieldEntity): Promise<CustomFieldDefinition[]> {
  const profile = await requireProfile()
  if (!profile.organization_id) return []
  let q = ops(supabaseAdmin, 'custom_field_definitions')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('sort_order')
  if (entity) q = q.eq('entity_type', entity)
  const { data, error } = await q
  if (error) return []
  return (data ?? []) as CustomFieldDefinition[]
}

export async function saveFieldDefinition(input: {
  id?: string
  entity_type: CustomFieldEntity
  label: string
  field_type: CustomFieldType
  options?: string[]
  required?: boolean
}) {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) return { error: 'No workspace' }
  const label = input.label.trim()
  if (!label) return { error: 'Label is required' }
  const field_key = slugifyLabel(label)
  const options = (input.options ?? []).filter(Boolean).map((o) => ({ value: slugifyLabel(o), label: o }))

  if (input.id) {
    const { error } = await ops(supabaseAdmin, 'custom_field_definitions')
      .update({ label, field_type: input.field_type, options, required: !!input.required })
      .eq('id', input.id)
      .eq('organization_id', profile.organization_id)
    if (error) return { error: error.message }
  } else {
    const { error } = await ops(supabaseAdmin, 'custom_field_definitions').insert({
      organization_id: profile.organization_id,
      entity_type: input.entity_type,
      field_key: `${field_key}_${Date.now().toString(36).slice(-3)}`,
      label,
      field_type: input.field_type,
      options,
      required: !!input.required,
      sort_order: 50,
    })
    if (error) return { error: error.message }
  }
  revalidateWorkspace()
  return { ok: true }
}

export async function setFieldDefinitionActive(id: string, is_active: boolean) {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) return { error: 'No workspace' }
  const { error } = await ops(supabaseAdmin, 'custom_field_definitions')
    .update({ is_active })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
  if (error) return { error: error.message }
  revalidateWorkspace()
  return { ok: true }
}

export async function getFieldValues(entityId: string): Promise<Record<string, string>> {
  const profile = await requireProfile()
  if (!profile.organization_id) return {}
  const { data, error } = await ops(supabaseAdmin, 'custom_field_values')
    .select('definition_id, value_text')
    .eq('organization_id', profile.organization_id)
    .eq('entity_id', entityId)
  if (error) return {}
  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    map[row.definition_id] = row.value_text ?? ''
  }
  return map
}

export async function saveFieldValues(entityId: string, values: Record<string, string>) {
  const profile = await requireProfile()
  if (!profile.organization_id) return { error: 'No workspace' }
  const rows = Object.entries(values).map(([definition_id, value_text]) => ({
    organization_id: profile.organization_id,
    definition_id,
    entity_id: entityId,
    value_text: value_text?.trim() || null,
    updated_at: new Date().toISOString(),
  }))
  if (rows.length === 0) return { ok: true }
  const { error } = await ops(supabaseAdmin, 'custom_field_values').upsert(rows, {
    onConflict: 'definition_id,entity_id',
  })
  if (error) return { error: error.message }
  return { ok: true }
}

export async function listChecklistTemplates(): Promise<ChecklistTemplate[]> {
  const profile = await requireProfile()
  if (!profile.organization_id) return []
  const { data, error } = await ops(supabaseAdmin, 'checklist_templates')
    .select('*, items:checklist_template_items(*)')
    .eq('organization_id', profile.organization_id)
    .order('name')
  if (error) return []
  return (data ?? []).map((t: ChecklistTemplate) => ({
    ...t,
    items: [...(t.items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }))
}

export async function saveChecklistTemplate(input: {
  id?: string
  name: string
  items: { label: string; required: boolean }[]
}) {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) return { error: 'No workspace' }
  const name = input.name.trim()
  if (!name) return { error: 'Name is required' }
  const items = input.items.map((i) => ({ label: i.label.trim(), required: i.required })).filter((i) => i.label)
  if (items.length === 0) return { error: 'Add at least one checklist item' }

  let templateId = input.id
  if (templateId) {
    const { error } = await ops(supabaseAdmin, 'checklist_templates')
      .update({ name })
      .eq('id', templateId)
      .eq('organization_id', profile.organization_id)
    if (error) return { error: error.message }
    await ops(supabaseAdmin, 'checklist_template_items')
      .delete()
      .eq('template_id', templateId)
      .eq('organization_id', profile.organization_id)
  } else {
    const { data, error } = await ops(supabaseAdmin, 'checklist_templates')
      .insert({ organization_id: profile.organization_id, name })
      .select('id')
      .single()
    if (error) return { error: error.message }
    templateId = data.id
  }

  const { error: itemsErr } = await ops(supabaseAdmin, 'checklist_template_items').insert(
    items.map((item, i) => ({
      organization_id: profile.organization_id,
      template_id: templateId,
      label: item.label,
      required: item.required,
      sort_order: (i + 1) * 10,
    })),
  )
  if (itemsErr) return { error: itemsErr.message }
  revalidateWorkspace()
  return { ok: true }
}

export async function setChecklistTemplateActive(id: string, is_active: boolean) {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) return { error: 'No workspace' }
  const { error } = await ops(supabaseAdmin, 'checklist_templates')
    .update({ is_active })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
  if (error) return { error: error.message }
  revalidateWorkspace()
  return { ok: true }
}

export async function updateEmployeeOps(input: {
  employee_id: string
  hourly_rate_cents: number
  location_id: string | null
  backup_approver_id: string | null
  skill_ids: string[]
}) {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) return { error: 'No workspace' }

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({
      hourly_rate_cents: Math.max(0, Math.round(input.hourly_rate_cents)),
      location_id: input.location_id,
      backup_approver_id: input.backup_approver_id,
    })
    .eq('id', input.employee_id)
    .eq('organization_id', profile.organization_id)
  if (error) return { error: error.message }

  await ops(supabaseAdmin, 'employee_skills').delete().eq('profile_id', input.employee_id)
  if (input.skill_ids.length) {
    const { error: skErr } = await ops(supabaseAdmin, 'employee_skills').insert(
      input.skill_ids.map((skill_id) => ({
        organization_id: profile.organization_id,
        profile_id: input.employee_id,
        skill_id,
      })),
    )
    if (skErr) return { error: skErr.message }
  }
  revalidatePath('/settings/workspace')
  revalidatePath('/employees')
  return { ok: true }
}

export async function listEmployeeSkillsMap(): Promise<Record<string, string[]>> {
  const profile = await requireProfile()
  if (!profile.organization_id) return {}
  const { data, error } = await ops(supabaseAdmin, 'employee_skills')
    .select('profile_id, skill_id')
    .eq('organization_id', profile.organization_id)
  if (error) return {}
  const map: Record<string, string[]> = {}
  for (const row of data ?? []) {
    if (!map[row.profile_id]) map[row.profile_id] = []
    map[row.profile_id].push(row.skill_id)
  }
  return map
}

/** Used by layout / clock / leave — never throws if 09 SQL is not applied yet. */
export async function loadWorkspaceSettingsSafe(): Promise<WorkspaceSettings> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return mergeWorkspaceSettings({})
    const { data: profile } = await supabase.from('profiles').select('organization_id').eq('id', user.id).maybeSingle()
    if (!profile?.organization_id) return mergeWorkspaceSettings({})
    const { data } = await supabase.from('organizations').select('settings').eq('id', profile.organization_id).maybeSingle()
    return mergeWorkspaceSettings(data?.settings)
  } catch {
    return mergeWorkspaceSettings({})
  }
}
