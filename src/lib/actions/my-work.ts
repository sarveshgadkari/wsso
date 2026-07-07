'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { parseExcelBuffer } from '@/lib/my-work/parse-excel'
import { parseDocumentBuffer } from '@/lib/my-work/parse-document'
import type {
  WorkSheet,
  WorkSheetRow,
  WorkOrderOption,
  DocBlock,
  WorkSheetWithAccess,
  WorkSheetShare,
  ShareableUser,
  WorkSheetFolder,
  WorkSheetFolderShare,
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
    .select('employee_id, folder_id')
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

  let canEdit = share?.can_edit ?? false
  let hasAccess = !!share

  if (sheet.folder_id) {
    const { data: folderShare } = await supabase
      .from('employee_work_sheet_folder_shares')
      .select('can_edit')
      .eq('folder_id', sheet.folder_id)
      .eq('shared_with', profileId)
      .maybeSingle()

    if (folderShare) {
      hasAccess = true
      canEdit = canEdit || folderShare.can_edit
    }
  }

  if (!hasAccess) throw new Error('Sheet not found or access denied')
  if (needEdit && !canEdit) throw new Error('You only have view access to this sheet')

  return { isOwner: false, canEdit }
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

async function assertFolderOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  folderId: string,
  profileId: string,
) {
  const { data: folder } = await supabase
    .from('employee_work_sheet_folders')
    .select('employee_id')
    .eq('id', folderId)
    .eq('employee_id', profileId)
    .maybeSingle()

  if (!folder) throw new Error('Folder not found or you are not the owner')
}

// ── List / read ───────────────────────────────────────────────────────────────

export async function listMyWorkSheets(): Promise<WorkSheetWithAccess[]> {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const [{ data: owned, error: ownedErr }, shareResult, folderShareResult] =
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
      supabase
        .from('employee_work_sheet_folder_shares')
        .select('can_edit, folder:employee_work_sheet_folders(id, name, employee_id)')
        .eq('shared_with', profile.id),
    ])

  if (ownedErr) throw new Error(ownedErr.message)

  // If a shares query isn't visible yet (schema cache), still show owned sheets.
  const shareRows = shareResult.error ? [] : (shareResult.data ?? [])
  if (shareResult.error) {
    console.error('[listMyWorkSheets] shares query failed:', shareResult.error.message)
  }
  const folderShareRows = folderShareResult.error ? [] : (folderShareResult.data ?? [])
  if (folderShareResult.error) {
    console.error('[listMyWorkSheets] folder shares query failed:', folderShareResult.error.message)
  }

  const ownedIds = (owned ?? []).map(s => s.id)
  const shareCountMap: Record<string, number> = {}

  if (ownedIds.length > 0) {
    const { data: shareCounts, error: countErr } = await supabase
      .from('employee_work_sheet_shares')
      .select('sheet_id')
      .in('sheet_id', ownedIds)

    if (!countErr) {
      for (const row of shareCounts ?? []) {
        shareCountMap[row.sheet_id] = (shareCountMap[row.sheet_id] ?? 0) + 1
      }
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

  // Sheets shared directly with me
  const sharedMap = new Map<string, { sheet: WorkSheet; canEdit: boolean; ownerId: string; viaFolder: string | null }>()
  for (const row of shareRows) {
    if (!row.sheet) continue
    const sheet = parseSheetRow(row.sheet as unknown)
    sharedMap.set(sheet.id, { sheet, canEdit: row.can_edit, ownerId: sheet.employee_id, viaFolder: null })
  }

  // Sheets shared via a folder — pull every sheet inside each folder shared with me
  const folderInfoById = new Map<string, { name: string; employeeId: string; canEdit: boolean }>()
  for (const row of folderShareRows) {
    if (!row.folder) continue
    const folder = row.folder as unknown as { id: string; name: string; employee_id: string }
    folderInfoById.set(folder.id, { name: folder.name, employeeId: folder.employee_id, canEdit: row.can_edit })
  }

  if (folderInfoById.size > 0) {
    const { data: folderSheets, error: folderSheetsErr } = await supabase
      .from('employee_work_sheets')
      .select('*')
      .in('folder_id', Array.from(folderInfoById.keys()))

    if (folderSheetsErr) {
      console.error('[listMyWorkSheets] folder sheets query failed:', folderSheetsErr.message)
    } else {
      for (const raw of folderSheets ?? []) {
        const sheet = parseSheetRow(raw)
        const info  = folderInfoById.get(sheet.folder_id ?? '')
        if (!info) continue
        const existing = sharedMap.get(sheet.id)
        sharedMap.set(sheet.id, {
          sheet,
          canEdit:   existing?.canEdit || info.canEdit,
          ownerId:   info.employeeId,
          viaFolder: info.name,
        })
      }
    }
  }

  const ownerIds = Array.from(new Set(Array.from(sharedMap.values()).map(e => e.ownerId)))
  const ownerNameMap: Record<string, string> = {}
  if (ownerIds.length > 0) {
    const { data: owners } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', ownerIds)
    for (const o of owners ?? []) ownerNameMap[o.id] = o.full_name
  }

  const sharedSheets: WorkSheetWithAccess[] = Array.from(sharedMap.values())
    .map(({ sheet, canEdit, ownerId, viaFolder }) => ({
      ...sheet,
      access: {
        isOwner:    false,
        canEdit,
        ownerName:  ownerNameMap[ownerId] ?? null,
        viaFolder,
      },
    }))
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

export async function createBlankWorkSheet(name: string, folderId?: string | null): Promise<WorkSheet> {
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
      folder_id:   folderId ?? null,
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

export async function createDocumentWorkSheet(name: string, folderId?: string | null): Promise<WorkSheet> {
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
      folder_id:   folderId ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidateMyWork()
  return parseSheetRow(data)
}

// ── Upload Excel ──────────────────────────────────────────────────────────────

export async function uploadWorkSheetExcel(formData: FormData): Promise<WorkSheet> {
  const profile   = await requireProfile()
  const file      = formData.get('file')
  const nameRaw   = formData.get('name')
  const folderRaw = formData.get('folderId')

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
      folder_id:     typeof folderRaw === 'string' && folderRaw ? folderRaw : null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidateMyWork()
  return parseSheetRow(data)
}

// ── Upload Document (Word .docx / .txt) ───────────────────────────────────────

export async function uploadWorkSheetDocument(formData: FormData): Promise<WorkSheet> {
  const profile   = await requireProfile()
  const file      = formData.get('file')
  const nameRaw   = formData.get('name')
  const folderRaw = formData.get('folderId')

  if (!(file instanceof File)) throw new Error('No file provided')
  if (!/\.(docx|txt)$/i.test(file.name)) {
    throw new Error('Please upload a Word document (.docx) or text file (.txt)')
  }

  const buffer = await file.arrayBuffer()
  const blocks = await parseDocumentBuffer(buffer, file.name)

  const name = (typeof nameRaw === 'string' && nameRaw.trim())
    ? nameRaw.trim()
    : file.name.replace(/\.(docx|txt)$/i, '')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('employee_work_sheets')
    .insert({
      employee_id:     profile.id,
      name,
      sheet_type:      'document',
      columns:         [],
      rows:            [],
      blocks,
      source_filename: file.name,
      folder_id:       typeof folderRaw === 'string' && folderRaw ? folderRaw : null,
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

// ── Folders ───────────────────────────────────────────────────────────────────

export async function listWorkSheetFolders(): Promise<WorkSheetFolder[]> {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_work_sheet_folders')
    .select('*')
    .eq('employee_id', profile.id)
    .order('name')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function createWorkSheetFolder(name: string): Promise<WorkSheetFolder> {
  const profile  = await requireProfile()
  const trimmed  = name.trim()
  if (!trimmed) throw new Error('Folder name is required')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_work_sheet_folders')
    .insert({ employee_id: profile.id, name: trimmed })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidateMyWork()
  return data
}

export async function renameWorkSheetFolder(folderId: string, name: string): Promise<WorkSheetFolder> {
  const profile  = await requireProfile()
  const trimmed  = name.trim()
  if (!trimmed) throw new Error('Folder name is required')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('employee_work_sheet_folders')
    .update({ name: trimmed })
    .eq('id', folderId)
    .eq('employee_id', profile.id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidateMyWork()
  return data
}

export async function deleteWorkSheetFolder(folderId: string): Promise<void> {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { error } = await supabase
    .from('employee_work_sheet_folders')
    .delete()
    .eq('id', folderId)
    .eq('employee_id', profile.id)

  if (error) throw new Error(error.message)
  revalidateMyWork()
}

export async function moveWorkSheetToFolder(sheetId: string, folderId: string | null): Promise<void> {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { error } = await supabase
    .from('employee_work_sheets')
    .update({ folder_id: folderId })
    .eq('id', sheetId)
    .eq('employee_id', profile.id)

  if (error) throw new Error(error.message)
  revalidateMyWork()
}

// ── Folder sharing ────────────────────────────────────────────────────────────

export async function listWorkSheetFolderShares(folderId: string): Promise<WorkSheetFolderShare[]> {
  const profile  = await requireProfile()
  const supabase = await createClient()
  await assertFolderOwner(supabase, folderId, profile.id)

  const { data, error } = await supabase
    .from('employee_work_sheet_folder_shares')
    .select('id, folder_id, shared_with, can_edit, created_at')
    .eq('folder_id', folderId)
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
    folder_id:   row.folder_id,
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

export async function shareWorkSheetFolder(
  folderId: string,
  userId: string,
  canEdit: boolean,
): Promise<WorkSheetFolderShare> {
  const profile  = await requireProfile()
  const supabase = await createClient()
  await assertFolderOwner(supabase, folderId, profile.id)

  if (userId === profile.id) throw new Error('You cannot share a folder with yourself')

  const { data: target, error: targetErr } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, employee_code, role')
    .eq('id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (targetErr || !target) throw new Error('User not found')

  const { data, error } = await supabase
    .from('employee_work_sheet_folder_shares')
    .upsert({
      folder_id:   folderId,
      shared_with: userId,
      can_edit:    canEdit,
      created_by:  profile.id,
    }, { onConflict: 'folder_id,shared_with' })
    .select('id, folder_id, shared_with, can_edit, created_at')
    .single()

  if (error) throw new Error(error.message)
  revalidateMyWork()
  return {
    id:          data.id,
    folder_id:   data.folder_id,
    shared_with: data.shared_with,
    can_edit:    data.can_edit,
    created_at:  data.created_at,
    user:        target as ShareableUser,
  }
}

export async function updateWorkSheetFolderShare(
  folderId: string,
  shareId: string,
  canEdit: boolean,
): Promise<void> {
  const profile  = await requireProfile()
  const supabase = await createClient()
  await assertFolderOwner(supabase, folderId, profile.id)

  const { error } = await supabase
    .from('employee_work_sheet_folder_shares')
    .update({ can_edit: canEdit })
    .eq('id', shareId)
    .eq('folder_id', folderId)

  if (error) throw new Error(error.message)
  revalidateMyWork()
}

export async function removeWorkSheetFolderShare(folderId: string, shareId: string): Promise<void> {
  const profile  = await requireProfile()
  const supabase = await createClient()
  await assertFolderOwner(supabase, folderId, profile.id)

  const { error } = await supabase
    .from('employee_work_sheet_folder_shares')
    .delete()
    .eq('id', shareId)
    .eq('folder_id', folderId)

  if (error) throw new Error(error.message)
  revalidateMyWork()
}

// ── Sharing ───────────────────────────────────────────────────────────────────

export async function getShareableUsers(): Promise<ShareableUser[]> {
  const profile = await requireProfile()

  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, employee_code, role')
    .eq('status', 'active')
    .neq('id', profile.id)
    .order('full_name')

  return (data ?? []) as ShareableUser[]
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
