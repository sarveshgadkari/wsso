'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parseExcelBuffer } from '@/lib/my-work/parse-excel'
import type {
  WorkSheet,
  WorkSheetRow,
  WorkOrderOption,
  DocBlock,
  WorkSheetWithAccess,
  WorkSheetShare,
  ShareableUser,
} from '@/lib/my-work/types'
import { DEFAULT_DOCUMENT_BLOCKS } from '@/lib/my-work/types'

const MAX_ROWS = 2000

function revalidateMyWork() {
  revalidatePath('/my-work')
  revalidatePath('/dashboard')
}

function parseSheetRow(raw: unknown): WorkSheet {
  const s = raw as WorkSheet
  return {
    ...s,
    sheet_type: s.sheet_type === 'document' ? 'document' : 'spreadsheet',
    columns:    Array.isArray(s.columns) ? s.columns : [],
    rows:       Array.isArray(s.rows)    ? s.rows    : [],
    blocks:     Array.isArray(s.blocks)  ? s.blocks  : [],
  }
}

async function assertSheetAccess(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sheetId: string,
  profileId: string,
  needEdit = false,
) {
  const { data: sheet } = await supabase
    .from('employee_work_sheets')
    .select('employee_id')
    .eq('id', sheetId)
    .maybeSingle()

  if (!sheet) throw new Error('Sheet not found')

  if (sheet.employee_id === profileId) return { isOwner: true, canEdit: true }

  const { data: share } = await supabase
    .from('employee_work_sheet_shares')
    .select('can_edit')
    .eq('sheet_id', sheetId)
    .eq('shared_with', profileId)
    .maybeSingle()

  if (!share) throw new Error('Sheet not found or access denied')
  if (needEdit && !share.can_edit) throw new Error('You only have view access to this sheet')

  return { isOwner: false, canEdit: share.can_edit }
}

async function assertSheetOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sheetId: string,
  profileId: string,
) {
  const { data: sheet } = await supabase
    .from('employee_work_sheets')
    .select('employee_id')
    .eq('id', sheetId)
    .eq('employee_id', profileId)
    .maybeSingle()

  if (!sheet) throw new Error('Sheet not found or you are not the owner')
}

// ── List / read ───────────────────────────────────────────────────────────────

export async function listMyWorkSheets(): Promise<WorkSheetWithAccess[]> {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const [{ data: owned, error: ownedErr }, { data: shareRows, error: shareErr }] =
    await Promise.all([
      supabase
        .from('employee_work_sheets')
        .select('*')
        .eq('employee_id', profile.id)
        .order('updated_at', { ascending: false }),
      supabase
        .from('employee_work_sheet_shares')
        .select('can_edit, sheet:employee_work_sheets(*)')
        .eq('shared_with', profile.id),
    ])

  if (ownedErr) throw new Error(ownedErr.message)
  if (shareErr) throw new Error(shareErr.message)

  const ownedIds = (owned ?? []).map(s => s.id)
  const shareCountMap: Record<string, number> = {}

  if (ownedIds.length > 0) {
    const { data: shareCounts } = await supabase
      .from('employee_work_sheet_shares')
      .select('sheet_id')
      .in('sheet_id', ownedIds)

    for (const row of shareCounts ?? []) {
      shareCountMap[row.sheet_id] = (shareCountMap[row.sheet_id] ?? 0) + 1
    }
  }

  const ownedSheets: WorkSheetWithAccess[] = (owned ?? []).map(s => ({
    ...parseSheetRow(s),
    access: {
      isOwner:     true,
      canEdit:     true,
      shareCount:  shareCountMap[s.id] ?? 0,
    },
  }))

  const sharedRaw = (shareRows ?? []).filter(row => row.sheet)
  const ownerIds = Array.from(new Set(
    sharedRaw.map(row => parseSheetRow(row.sheet as unknown).employee_id),
  ))
  const ownerNameMap: Record<string, string> = {}
  if (ownerIds.length > 0) {
    const { data: owners } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', ownerIds)
    for (const o of owners ?? []) ownerNameMap[o.id] = o.full_name
  }

  const sharedSheets: WorkSheetWithAccess[] = sharedRaw
    .map(row => {
      const sheet = parseSheetRow(row.sheet as unknown)
      return {
        ...sheet,
        access: {
          isOwner:    false,
          canEdit:    row.can_edit,
          ownerName:  ownerNameMap[sheet.employee_id] ?? null,
        },
      }
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  return [...ownedSheets, ...sharedSheets]
}

export async function getMyWorkSheetCount(): Promise<number> {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('employee_work_sheets')
    .select('id', { count: 'exact', head: true })
    .eq('employee_id', profile.id)

  if (error) return 0
  return count ?? 0
}

// ── Create blank spreadsheet (grid) ─────────────────────────────────────────

export async function createBlankWorkSheet(name: string): Promise<WorkSheet> {
  const profile  = await requireProfile()
  const supabase = await createClient()
  const trimmed  = name.trim() || 'My sheet'

  const { data, error } = await supabase
    .from('employee_work_sheets')
    .insert({
      employee_id: profile.id,
      name:        trimmed,
      sheet_type:  'spreadsheet',
      columns:     ['Task', 'Notes', 'Status'],
      rows:        [],
      blocks:      [],
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidateMyWork()
  return parseSheetRow(data)
}

// ── Create Notion-style document page ───────────────────────────────────────────

function freshDocumentBlocks(): DocBlock[] {
  return DEFAULT_DOCUMENT_BLOCKS.map(b => ({
    ...b,
    id: crypto.randomUUID(),
  }))
}

export async function createDocumentWorkSheet(name: string): Promise<WorkSheet> {
  const profile  = await requireProfile()
  const supabase = await createClient()
  const trimmed  = name.trim() || 'Untitled page'

  const { data, error } = await supabase
    .from('employee_work_sheets')
    .insert({
      employee_id: profile.id,
      name:        trimmed,
      sheet_type:  'document',
      columns:     [],
      rows:        [],
      blocks:      freshDocumentBlocks(),
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidateMyWork()
  return parseSheetRow(data)
}

// ── Upload Excel ──────────────────────────────────────────────────────────────

export async function uploadWorkSheetExcel(formData: FormData): Promise<WorkSheet> {
  const profile = await requireProfile()
  const file    = formData.get('file')
  const nameRaw = formData.get('name')

  if (!(file instanceof File)) throw new Error('No file provided')
  if (!/\.xlsx?$/i.test(file.name) && !file.type.includes('spreadsheet') && !file.type.includes('excel')) {
    throw new Error('Please upload an Excel file (.xlsx or .xls)')
  }

  const buffer = await file.arrayBuffer()
  const { columns, rows } = parseExcelBuffer(buffer)

  if (rows.length > MAX_ROWS) {
    throw new Error(`Sheet has too many rows (max ${MAX_ROWS}). Split into smaller files.`)
  }

  const name = (typeof nameRaw === 'string' && nameRaw.trim())
    ? nameRaw.trim()
    : file.name.replace(/\.xlsx?$/i, '')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employee_work_sheets')
    .insert({
      employee_id:     profile.id,
      name,
      sheet_type:    'spreadsheet',
      columns,
      rows,
      blocks:        [],
      source_filename: file.name,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidateMyWork()
  return parseSheetRow(data)
}

// ── Update sheet data ─────────────────────────────────────────────────────────

const blockSchema = z.object({
  id:      z.string().min(1),
  type:    z.enum(['paragraph', 'heading1', 'heading2', 'heading3', 'bullet', 'numbered', 'todo', 'divider']),
  text:    z.string().max(20_000),
  checked: z.boolean().optional(),
})

const updateSchema = z.object({
  name:    z.string().min(1).max(120).optional(),
  columns: z.array(z.string().min(1).max(80)).max(30).optional(),
  rows:    z.array(z.object({
    id:        z.string().uuid(),
    cells:     z.record(z.string()),
    tactic_id: z.string().uuid().nullable().optional(),
  })).max(MAX_ROWS).optional(),
  blocks:  z.array(blockSchema).max(500).optional(),
})

export async function updateWorkSheet(
  sheetId: string,
  raw: z.infer<typeof updateSchema>,
): Promise<WorkSheet> {
  const profile = await requireProfile()
  const input   = updateSchema.parse(raw)
  const supabase = await createClient()

  await assertSheetAccess(supabase, sheetId, profile.id, true)

  const patch: Record<string, unknown> = {}
  if (input.name    !== undefined) patch.name    = input.name
  if (input.columns !== undefined) patch.columns = input.columns
  if (input.rows    !== undefined) patch.rows    = input.rows
  if (input.blocks  !== undefined) patch.blocks  = input.blocks

  const { data, error } = await supabase
    .from('employee_work_sheets')
    .update(patch)
    .eq('id', sheetId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidateMyWork()
  return parseSheetRow(data)
}

export async function deleteWorkSheet(sheetId: string): Promise<void> {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { error } = await supabase
    .from('employee_work_sheets')
    .delete()
    .eq('id', sheetId)
    .eq('employee_id', profile.id)

  if (error) throw new Error(error.message)
  revalidateMyWork()
}

// ── Work order linking ────────────────────────────────────────────────────────

export async function getMyWorkOrderOptions(): Promise<WorkOrderOption[]> {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tactics')
    .select('id, code, title, status')
    .eq('assigned_to', profile.id)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createPersonalWorkOrder(
  title:       string,
  description: string | null,
): Promise<{ id: string; code: string; title: string }> {
  const profile = await requireProfile()
  const trimmed = title.trim()
  if (!trimmed) throw new Error('Title is required')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tactics')
    .insert({
      title:       trimmed,
      description: description?.trim() || null,
      assigned_to: profile.id,
      created_by:  profile.id,
      priority:    'medium',
      status:      'assigned',
    })
    .select('id, code, title')
    .single()

  if (error) throw new Error(error.message)

  await supabaseAdmin.from('activity_logs').insert({
    tactic_id:   data.id,
    employee_id: profile.id,
    action:      'Personal work order created from My Work',
  })

  revalidatePath('/tactics')
  revalidatePath('/kanban')
  revalidatePath('/dashboard')
  return data
}

export async function linkRowToWorkOrder(
  sheetId:   string,
  rowId:     string,
  tacticId:  string | null,
): Promise<WorkSheetRow[]> {
  const profile  = await requireProfile()
  const supabase = await createClient()

  await assertSheetAccess(supabase, sheetId, profile.id, true)

  const { data: sheet, error: fetchErr } = await supabase
    .from('employee_work_sheets')
    .select('rows')
    .eq('id', sheetId)
    .single()

  if (fetchErr || !sheet) throw new Error('Sheet not found')

  const rows = (sheet.rows as WorkSheetRow[]) ?? []
  const idx  = rows.findIndex(r => r.id === rowId)
  if (idx < 0) throw new Error('Row not found')

  if (tacticId) {
    const { data: tactic } = await supabase
      .from('tactics')
      .select('id')
      .eq('id', tacticId)
      .eq('assigned_to', profile.id)
      .maybeSingle()
    if (!tactic) throw new Error('Work order not found or not assigned to you')
  }

  rows[idx] = { ...rows[idx], tactic_id: tacticId }

  const { error } = await supabase
    .from('employee_work_sheets')
    .update({ rows })
    .eq('id', sheetId)

  if (error) throw new Error(error.message)
  revalidateMyWork()
  return rows
}

export async function createWorkOrderFromRow(
  sheetId: string,
  rowId:   string,
): Promise<{ sheet: WorkSheet; tactic: { id: string; code: string; title: string } }> {
  const profile  = await requireProfile()
  const supabase = await createClient()

  await assertSheetAccess(supabase, sheetId, profile.id, true)

  const { data: sheet, error: fetchErr } = await supabase
    .from('employee_work_sheets')
    .select('*')
    .eq('id', sheetId)
    .single()

  if (fetchErr || !sheet) throw new Error('Sheet not found')

  const parsed = parseSheetRow(sheet)
  const row    = parsed.rows.find(r => r.id === rowId)
  if (!row) throw new Error('Row not found')

  const titleCol = parsed.columns.find(c =>
    /task|title|work|subject|name/i.test(c),
  ) ?? parsed.columns[0]

  const title = (row.cells[titleCol] ?? '').trim() || 'New task'
  const descParts = parsed.columns
    .filter(c => c !== titleCol)
    .map(c => `${c}: ${row.cells[c] ?? ''}`)
    .filter(s => s.length > 2)
    .join('\n')

  const tactic = await createPersonalWorkOrder(title, descParts || null)
  const rows   = await linkRowToWorkOrder(sheetId, rowId, tactic.id)

  return {
    sheet: { ...parsed, rows },
    tactic,
  }
}

// ── Sharing ───────────────────────────────────────────────────────────────────

export async function getShareableUsers(): Promise<ShareableUser[]> {
  const profile = await requireProfile()

  const [{ data: elevated }, { data: me }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, employee_code, role')
      .in('role', ['admin', 'manager'])
      .eq('status', 'active')
      .order('full_name'),
    supabaseAdmin
      .from('profiles')
      .select('manager_id')
      .eq('id', profile.id)
      .single(),
  ])

  const byId = new Map<string, ShareableUser>()
  for (const u of elevated ?? []) {
    if (u.id !== profile.id) byId.set(u.id, u as ShareableUser)
  }

  if (me?.manager_id && me.manager_id !== profile.id) {
    const { data: manager } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, employee_code, role')
      .eq('id', me.manager_id)
      .eq('status', 'active')
      .maybeSingle()
    if (manager) byId.set(manager.id, manager as ShareableUser)
  }

  return Array.from(byId.values()).sort((a, b) => a.full_name.localeCompare(b.full_name))
}

export async function listWorkSheetShares(sheetId: string): Promise<WorkSheetShare[]> {
  const profile  = await requireProfile()
  const supabase = await createClient()
  await assertSheetOwner(supabase, sheetId, profile.id)

  const { data, error } = await supabase
    .from('employee_work_sheet_shares')
    .select('id, sheet_id, shared_with, can_edit, created_at')
    .eq('sheet_id', sheetId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  if (!data?.length) return []

  const userIds = data.map(r => r.shared_with)
  const { data: users } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, employee_code, role')
    .in('id', userIds)

  const userMap = Object.fromEntries((users ?? []).map(u => [u.id, u as ShareableUser]))

  return data.map(row => ({
    id:          row.id,
    sheet_id:    row.sheet_id,
    shared_with: row.shared_with,
    can_edit:    row.can_edit,
    created_at:  row.created_at,
    user:        userMap[row.shared_with] ?? {
      id:            row.shared_with,
      full_name:     'Unknown',
      employee_code: '—',
      role:          'employee',
    },
  }))
}

export async function shareWorkSheet(
  sheetId: string,
  userId: string,
  canEdit: boolean,
): Promise<WorkSheetShare> {
  const profile  = await requireProfile()
  const supabase = await createClient()
  await assertSheetOwner(supabase, sheetId, profile.id)

  if (userId === profile.id) throw new Error('You cannot share a sheet with yourself')

  const { data: target, error: targetErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, employee_code, role')
    .eq('id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (targetErr || !target) throw new Error('User not found')
  if (!['admin', 'manager'].includes(target.role)) {
    throw new Error('You can only share with managers or admins')
  }

  const { data, error } = await supabase
    .from('employee_work_sheet_shares')
    .upsert({
      sheet_id:    sheetId,
      shared_with: userId,
      can_edit:    canEdit,
      created_by:  profile.id,
    }, { onConflict: 'sheet_id,shared_with' })
    .select('id, sheet_id, shared_with, can_edit, created_at')
    .single()

  if (error) throw new Error(error.message)
  revalidateMyWork()
  return {
    id:          data.id,
    sheet_id:    data.sheet_id,
    shared_with: data.shared_with,
    can_edit:    data.can_edit,
    created_at:  data.created_at,
    user:        target as ShareableUser,
  }
}

export async function updateWorkSheetShare(
  sheetId: string,
  shareId: string,
  canEdit: boolean,
): Promise<void> {
  const profile  = await requireProfile()
  const supabase = await createClient()
  await assertSheetOwner(supabase, sheetId, profile.id)

  const { error } = await supabase
    .from('employee_work_sheet_shares')
    .update({ can_edit: canEdit })
    .eq('id', shareId)
    .eq('sheet_id', sheetId)

  if (error) throw new Error(error.message)
  revalidateMyWork()
}

export async function removeWorkSheetShare(sheetId: string, shareId: string): Promise<void> {
  const profile  = await requireProfile()
  const supabase = await createClient()
  await assertSheetOwner(supabase, sheetId, profile.id)

  const { error } = await supabase
    .from('employee_work_sheet_shares')
    .delete()
    .eq('id', shareId)
    .eq('sheet_id', sheetId)

  if (error) throw new Error(error.message)
  revalidateMyWork()
}
