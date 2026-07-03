'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parseExcelBuffer } from '@/lib/my-work/parse-excel'
import type { WorkSheet, WorkSheetRow, WorkOrderOption, DocBlock } from '@/lib/my-work/types'
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

// ── List / read ───────────────────────────────────────────────────────────────

export async function listMyWorkSheets(): Promise<WorkSheet[]> {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_work_sheets')
    .select('*')
    .eq('employee_id', profile.id)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(parseSheetRow)
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

  const patch: Record<string, unknown> = {}
  if (input.name    !== undefined) patch.name    = input.name
  if (input.columns !== undefined) patch.columns = input.columns
  if (input.rows    !== undefined) patch.rows    = input.rows
  if (input.blocks  !== undefined) patch.blocks  = input.blocks

  const { data, error } = await supabase
    .from('employee_work_sheets')
    .update(patch)
    .eq('id', sheetId)
    .eq('employee_id', profile.id)
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

  const { data: sheet, error: fetchErr } = await supabase
    .from('employee_work_sheets')
    .select('rows')
    .eq('id', sheetId)
    .eq('employee_id', profile.id)
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
    .eq('employee_id', profile.id)

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

  const { data: sheet, error: fetchErr } = await supabase
    .from('employee_work_sheets')
    .select('*')
    .eq('id', sheetId)
    .eq('employee_id', profile.id)
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
