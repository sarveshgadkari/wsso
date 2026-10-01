'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireProfile, requireRole } from '@/lib/auth/session'
import { requireOrgId } from '@/lib/saas/tenant'
import { listManagedTeamIds } from '@/lib/saas/team-scope'
import type { DailyWorkEntry, Profile, UserRole } from '@/lib/types'
import {
  DAILY_WORK_CATEGORIES,
  EXECUTIVE_ROLES,
  PRODUCT_OPTIONS,
  WORKER_TYPES,
  hoursBetween,
} from '@/lib/daily-work/catalog'

const workerValues = WORKER_TYPES.map((row) => row.value) as [string, ...string[]]
const categoryValues = DAILY_WORK_CATEGORIES.map((row) => row.value) as [string, ...string[]]
const productValues = PRODUCT_OPTIONS.map((row) => row.value) as [string, ...string[]]
const executiveValues = EXECUTIVE_ROLES.map((row) => row.value) as [string, ...string[]]

const entrySchema = z.object({
  work_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
  worker_type: z.enum(workerValues),
  category: z.enum(categoryValues),
  product: z.enum(productValues).optional().nullable(),
  product_detail: z.string().trim().max(80).optional().nullable(),
  executive_role: z.enum(executiveValues).optional().nullable(),
  task: z.string().trim().min(3, 'Describe the task').max(500),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Enter a start time'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Enter an end time'),
  notes: z.string().trim().max(1000).optional().nullable(),
})

export type DailyWorkInput = z.infer<typeof entrySchema>

export type DailyWorkPerson = {
  id: string
  full_name: string
  employee_code: string
  role: UserRole
  manager_id: string | null
  team_id: string | null
}

export type DailyWorkRow = DailyWorkEntry & {
  employee: DailyWorkPerson | null
}

const PERSON_SELECT = 'id, full_name, employee_code, role, manager_id, team_id'

function fail(message: string): { error: string } {
  return { error: message }
}

function normalizeInput(input: DailyWorkInput) {
  const parsed = entrySchema.safeParse(input)
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Check the form and try again'
    return { error: message }
  }
  const values = parsed.data
  const hours = hoursBetween(values.start_time, values.end_time)
  if (hours == null) {
    return { error: 'End time must be later than start time on the same day, and no more than 24 hours.' }
  }
  if (values.category === 'product_development' && !values.product) {
    return { error: 'Choose the product this time belongs to.' }
  }
  if (values.category === 'product_development' && values.product === 'other' && !values.product_detail?.trim()) {
    return { error: 'Name the product when you choose Other.' }
  }
  if (values.category === 'executive' && !values.executive_role) {
    return { error: 'Choose the executive role for this time.' }
  }
  return {
    data: {
      ...values,
      product: values.category === 'product_development' ? values.product ?? null : null,
      product_detail:
        values.category === 'product_development' && values.product === 'other'
          ? values.product_detail?.trim() || null
          : null,
      executive_role: values.category === 'executive' ? values.executive_role ?? null : null,
      notes: values.notes?.trim() || null,
      hours,
    },
  }
}

function isMissingTable(message: string) {
  const text = message.toLowerCase()
  return text.includes('daily_work_entries') && (text.includes('schema cache') || text.includes('does not exist') || text.includes('could not find'))
}

export async function listMyDailyWork(from: string, to: string): Promise<{ rows: DailyWorkRow[]; error?: string }> {
  const profile = await requireProfile()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('daily_work_entries')
    .select(`*, employee:profiles!daily_work_entries_employee_id_fkey(${PERSON_SELECT})`)
    .eq('employee_id', profile.id)
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date', { ascending: false })
    .order('start_time', { ascending: false })

  if (error) {
    if (isMissingTable(error.message)) return { rows: [], error: 'missing_table' }
    return { rows: [], error: error.message }
  }
  return { rows: (data ?? []) as DailyWorkRow[] }
}

export async function listReviewDailyWork(from: string, to: string): Promise<{ rows: DailyWorkRow[]; error?: string }> {
  const profile = await requireRole(['admin', 'manager'])
  const orgId = requireOrgId(profile)
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('daily_work_entries')
    .select(`*, employee:profiles!daily_work_entries_employee_id_fkey(${PERSON_SELECT})`)
    .eq('organization_id', orgId)
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date', { ascending: false })
    .order('start_time', { ascending: false })

  if (error) {
    if (isMissingTable(error.message)) return { rows: [], error: 'missing_table' }
    return { rows: [], error: error.message }
  }

  let rows = (data ?? []) as DailyWorkRow[]
  if (profile.role === 'manager') {
    const teamIds = await listManagedTeamIds(profile.id, profile.team_id)
    rows = rows.filter((row) => {
      const person = row.employee
      if (!person || person.role !== 'employee' || person.id === profile.id) return false
      if (person.manager_id === profile.id) return true
      return Boolean(person.team_id && teamIds.includes(person.team_id))
    })
  }
  return { rows }
}

export async function createDailyWork(input: DailyWorkInput): Promise<{ error?: string }> {
  const profile = await requireProfile()
  const orgId = requireOrgId(profile)
  const normalized = normalizeInput(input)
  if ('error' in normalized && normalized.error) return fail(normalized.error)
  const values = normalized.data!
  const supabase = await createClient()
  const { error } = await supabase.from('daily_work_entries').insert({
    organization_id: orgId,
    employee_id: profile.id,
    work_date: values.work_date,
    worker_type: values.worker_type as DailyWorkEntry['worker_type'],
    category: values.category as DailyWorkEntry['category'],
    product: values.product,
    product_detail: values.product_detail,
    executive_role: values.executive_role,
    task: values.task,
    start_time: values.start_time,
    end_time: values.end_time,
    hours: values.hours,
    notes: values.notes,
    status: 'submitted',
  })
  if (error) {
    if (isMissingTable(error.message)) return fail('Daily Work is not set up in the database yet. Run saas/13_daily_work.sql in Supabase, then try again.')
    return fail(error.message)
  }
  revalidatePath('/daily-work')
  return {}
}

export async function updateDailyWork(id: string, input: DailyWorkInput): Promise<{ error?: string }> {
  const profile = await requireProfile()
  const normalized = normalizeInput(input)
  if ('error' in normalized && normalized.error) return fail(normalized.error)
  const values = normalized.data!
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('daily_work_entries')
    .select('id, employee_id, status')
    .eq('id', id)
    .maybeSingle()
  if (!existing || existing.employee_id !== profile.id) return fail('Entry not found')
  if (existing.status !== 'submitted') return fail('Done entries cannot be edited.')

  const { error } = await supabase
    .from('daily_work_entries')
    .update({
      work_date: values.work_date,
      worker_type: values.worker_type as DailyWorkEntry['worker_type'],
      category: values.category as DailyWorkEntry['category'],
      product: values.product,
      product_detail: values.product_detail,
      executive_role: values.executive_role,
      task: values.task,
      start_time: values.start_time,
      end_time: values.end_time,
      hours: values.hours,
      notes: values.notes,
    })
    .eq('id', id)
    .eq('employee_id', profile.id)
    .eq('status', 'submitted')

  if (error) return fail(error.message)
  revalidatePath('/daily-work')
  return {}
}

export async function deleteDailyWork(id: string): Promise<{ error?: string }> {
  const profile = await requireProfile()
  const supabase = await createClient()
  const { error } = await supabase
    .from('daily_work_entries')
    .delete()
    .eq('id', id)
    .eq('employee_id', profile.id)
    .eq('status', 'submitted')
  if (error) return fail(error.message)
  revalidatePath('/daily-work')
  return {}
}

async function canReviewEntry(viewer: Profile, employeeId: string) {
  if (viewer.role === 'admin') return viewer.organization_id != null
  if (viewer.role !== 'manager' || employeeId === viewer.id) return false
  const supabase = await createClient()
  const { data: person } = await supabase
    .from('profiles')
    .select('id, role, manager_id, team_id, organization_id')
    .eq('id', employeeId)
    .maybeSingle()
  if (!person || person.organization_id !== viewer.organization_id || person.role !== 'employee') return false
  if (person.manager_id === viewer.id) return true
  const teamIds = await listManagedTeamIds(viewer.id, viewer.team_id)
  return Boolean(person.team_id && teamIds.includes(person.team_id))
}

export async function setDailyWorkStatus(id: string, status: 'submitted' | 'done'): Promise<{ error?: string }> {
  const viewer = await requireRole(['admin', 'manager'])
  const supabase = await createClient()
  const { data: row } = await supabase
    .from('daily_work_entries')
    .select('id, employee_id, organization_id, status')
    .eq('id', id)
    .maybeSingle()
  if (!row || row.organization_id !== viewer.organization_id) return fail('Entry not found')

  const allowed = await canReviewEntry(viewer, row.employee_id)
  if (!allowed) {
    return fail(
      viewer.role === 'manager'
        ? 'You can only mark work done for employees on your team. Manager entries are reviewed by an admin.'
        : 'You cannot review this entry.',
    )
  }
  if (status === 'submitted' && viewer.role !== 'admin') {
    return fail('Only an admin can reopen an entry.')
  }

  const { error } = await supabase
    .from('daily_work_entries')
    .update({
      status,
      reviewed_by: status === 'done' ? viewer.id : null,
      reviewed_at: status === 'done' ? new Date().toISOString() : null,
    })
    .eq('id', id)

  if (error) return fail(error.message)
  revalidatePath('/daily-work')
  return {}
}
