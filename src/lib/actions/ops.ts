'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireProfile, requireRole } from '@/lib/auth/session'
import { ops } from '@/lib/workspace/db'
import { mergeWorkspaceSettings } from '@/lib/workspace/settings'
import { todayInTimezone, startOfWeekInTimezone } from '@/lib/utils/dates'
import { resolveTimezone } from '@/lib/utils/timezones'
import type { ComplianceRecord, LeadFollowUp, RecurringJob, TacticChecklistItem } from '@/lib/workspace/rows'

function revalidateOps() {
  revalidatePath('/dashboard')
  revalidatePath('/crm')
  revalidatePath('/my-leads')
  revalidatePath('/approvals')
  revalidatePath('/tactics')
  revalidatePath('/compliance')
  revalidatePath('/clients')
  revalidatePath('/time/team')
  revalidatePath('/settings/workspace')
}

export async function convertLeadToClient(input: {
  leadId: string
  company_id: string
  outcome_reason?: string | null
  createProject?: boolean
}) {
  const profile = await requireRole(['admin'])
  if (!profile.organization_id) return { error: 'No workspace' }

  const { data: lead, error: leadErr } = await supabaseAdmin
    .from('leads')
    .select('*')
    .eq('id', input.leadId)
    .eq('organization_id' as never, profile.organization_id)
    .single()
  if (leadErr || !lead) return { error: 'Lead not found' }
  if (lead.status === 'converted' && lead.converted_client_id) {
    return { error: 'This lead is already converted.' }
  }

  const clientName = lead.company?.trim() || `${lead.first_name} ${lead.last_name}`.trim()
  const { data: client, error: clientErr } = await supabaseAdmin
    .from('clients')
    .insert({
      name: clientName,
      company_id: input.company_id,
      contact_name: `${lead.first_name} ${lead.last_name}`.trim(),
      contact_email: lead.email,
      organization_id: profile.organization_id,
    } as never)
    .select('id, name, code')
    .single()
  if (clientErr || !client) return { error: clientErr?.message ?? 'Could not create client' }

  let projectId: string | null = null
  if (input.createProject) {
    const { data: project, error: pErr } = await supabaseAdmin
      .from('projects')
      .insert({
        name: `${clientName} — kickoff`,
        client_id: client.id,
        company_id: input.company_id,
        organization_id: profile.organization_id,
        status: 'active',
      } as never)
      .select('id')
      .single()
    if (pErr) return { error: pErr.message }
    projectId = project.id
  }

  const { error } = await supabaseAdmin
    .from('leads')
    .update({
      status: 'converted',
      converted_client_id: client.id,
      outcome_reason: input.outcome_reason?.trim() || null,
    })
    .eq('id', lead.id)
  if (error) return { error: error.message }

  revalidateOps()
  return { data: { clientId: client.id, clientCode: client.code, projectId } }
}

export async function setLeadOutcome(leadId: string, status: 'converted' | 'lost', reason: string | null) {
  const profile = await requireProfile()
  if (profile.role !== 'admin') {
    const { data: assignment } = await supabaseAdmin
      .from('lead_assignments')
      .select('id')
      .eq('lead_id', leadId)
      .eq('employee_id', profile.id)
      .maybeSingle()
    if (!assignment) return { error: 'Not authorized' }
  }
  const { error } = await supabaseAdmin
    .from('leads')
    .update({ status, outcome_reason: reason?.trim() || null })
    .eq('id', leadId)
  if (error) return { error: error.message }
  revalidateOps()
  return { ok: true }
}

export async function saveLeadFollowUp(input: {
  id?: string
  leadId: string
  due_on: string
  note?: string
  assigned_to?: string | null
}) {
  const profile = await requireProfile()
  if (!profile.organization_id) return { error: 'No workspace' }
  if (!input.due_on) return { error: 'Due date is required' }

  if (input.id) {
    const { error } = await ops(supabaseAdmin, 'lead_follow_ups')
      .update({
        due_on: input.due_on,
        note: input.note?.trim() || null,
        assigned_to: input.assigned_to || null,
      })
      .eq('id', input.id)
      .eq('organization_id', profile.organization_id)
    if (error) return { error: error.message }
  } else {
    const { error } = await ops(supabaseAdmin, 'lead_follow_ups').insert({
      organization_id: profile.organization_id,
      lead_id: input.leadId,
      due_on: input.due_on,
      note: input.note?.trim() || null,
      assigned_to: input.assigned_to || profile.id,
      created_by: profile.id,
    })
    if (error) return { error: error.message }
  }

  await supabaseAdmin
    .from('leads')
    .update({ next_follow_up_at: input.due_on })
    .eq('id', input.leadId)

  revalidateOps()
  return { ok: true }
}

export async function completeLeadFollowUp(id: string) {
  const profile = await requireProfile()
  if (!profile.organization_id) return { error: 'No workspace' }
  const { error } = await ops(supabaseAdmin, 'lead_follow_ups')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
  if (error) return { error: error.message }
  revalidateOps()
  return { ok: true }
}

export async function listLeadFollowUps(leadId: string): Promise<LeadFollowUp[]> {
  const profile = await requireProfile()
  if (!profile.organization_id) return []
  const { data, error } = await ops(supabaseAdmin, 'lead_follow_ups')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .eq('lead_id', leadId)
    .order('due_on')
  if (error) return []
  return (data ?? []) as LeadFollowUp[]
}

export async function applyChecklistToTactic(tacticId: string, templateId: string) {
  const profile = await requireProfile()
  if (!profile.organization_id) return { error: 'No workspace' }
  if (!['admin', 'manager'].includes(profile.role)) return { error: 'Access denied' }

  const { data: items, error } = await ops(supabaseAdmin, 'checklist_template_items')
    .select('*')
    .eq('template_id', templateId)
    .eq('organization_id', profile.organization_id)
    .order('sort_order')
  if (error) return { error: error.message }
  if (!items?.length) return { error: 'Template has no items' }

  await ops(supabaseAdmin, 'tactic_checklist_items')
    .delete()
    .eq('tactic_id', tacticId)
    .eq('organization_id', profile.organization_id)

  const { error: insErr } = await ops(supabaseAdmin, 'tactic_checklist_items').insert(
    items.map((item: { id: string; label: string; required: boolean; sort_order: number }) => ({
      organization_id: profile.organization_id,
      tactic_id: tacticId,
      template_item_id: item.id,
      label: item.label,
      required: item.required,
      sort_order: item.sort_order,
    })),
  )
  if (insErr) return { error: insErr.message }

  await supabaseAdmin
    .from('tactics')
    .update({ checklist_template_id: templateId })
    .eq('id', tacticId)
    .eq('organization_id', profile.organization_id)

  revalidatePath(`/tactics/${tacticId}`)
  return { ok: true }
}

export async function listTacticChecklist(tacticId: string): Promise<TacticChecklistItem[]> {
  const profile = await requireProfile()
  if (!profile.organization_id) return []
  const { data, error } = await ops(supabaseAdmin, 'tactic_checklist_items')
    .select('*')
    .eq('tactic_id', tacticId)
    .eq('organization_id', profile.organization_id)
    .order('sort_order')
  if (error) return []
  return (data ?? []) as TacticChecklistItem[]
}

export async function toggleTacticChecklistItem(id: string, completed: boolean) {
  const profile = await requireProfile()
  if (!profile.organization_id) return { error: 'No workspace' }
  const { error } = await ops(supabaseAdmin, 'tactic_checklist_items')
    .update({
      completed,
      completed_by: completed ? profile.id : null,
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
  if (error) return { error: error.message }
  revalidatePath('/tactics')
  return { ok: true }
}

export async function saveComplianceRecord(input: {
  id?: string
  title: string
  type_id?: string | null
  profile_id?: string | null
  client_id?: string | null
  expires_on?: string | null
  notes?: string | null
}) {
  const profile = await requireRole(['admin', 'manager'])
  if (!profile.organization_id) return { error: 'No workspace' }
  const title = input.title.trim()
  if (!title) return { error: 'Title is required' }

  const row = {
    title,
    type_id: input.type_id || null,
    profile_id: input.profile_id || null,
    client_id: input.client_id || null,
    expires_on: input.expires_on || null,
    notes: input.notes?.trim() || null,
  }

  if (input.id) {
    const { error } = await ops(supabaseAdmin, 'compliance_records')
      .update(row)
      .eq('id', input.id)
      .eq('organization_id', profile.organization_id)
    if (error) return { error: error.message }
  } else {
    const { error } = await ops(supabaseAdmin, 'compliance_records').insert({
      ...row,
      organization_id: profile.organization_id,
      created_by: profile.id,
    })
    if (error) return { error: error.message }
  }
  revalidateOps()
  return { ok: true }
}

export async function deleteComplianceRecord(id: string) {
  const profile = await requireRole(['admin', 'manager'])
  if (!profile.organization_id) return { error: 'No workspace' }
  const { error } = await ops(supabaseAdmin, 'compliance_records')
    .delete()
    .eq('id', id)
    .eq('organization_id', profile.organization_id)
  if (error) return { error: error.message }
  revalidateOps()
  return { ok: true }
}

export async function listComplianceRecords(): Promise<ComplianceRecord[]> {
  const profile = await requireProfile()
  if (!profile.organization_id) return []
  const { data, error } = await ops(supabaseAdmin, 'compliance_records')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('expires_on', { ascending: true, nullsFirst: false })
  if (error) return []
  return (data ?? []) as ComplianceRecord[]
}

export async function saveRecurringJob(input: Omit<RecurringJob, 'id' | 'last_run_on'> & { id?: string }) {
  const profile = await requireRole(['admin', 'manager'])
  if (!profile.organization_id) return { error: 'No workspace' }
  const title = input.title.trim()
  if (!title) return { error: 'Title is required' }
  if (!input.assigned_to) return { error: 'Assign someone' }
  if (!input.next_run_on) return { error: 'Next run date is required' }

  const row = {
    title,
    description: input.description?.trim() || null,
    project_id: input.project_id || null,
    assigned_to: input.assigned_to,
    checklist_template_id: input.checklist_template_id || null,
    work_order_type_id: input.work_order_type_id || null,
    priority: input.priority,
    estimated_hours: input.estimated_hours,
    frequency: input.frequency,
    interval_n: Math.max(1, input.interval_n),
    next_run_on: input.next_run_on,
    is_active: input.is_active,
  }

  if (input.id) {
    const { error } = await ops(supabaseAdmin, 'org_recurring_jobs')
      .update(row)
      .eq('id', input.id)
      .eq('organization_id', profile.organization_id)
    if (error) return { error: error.message }
  } else {
    const { error } = await ops(supabaseAdmin, 'org_recurring_jobs').insert({
      ...row,
      organization_id: profile.organization_id,
      created_by: profile.id,
    })
    if (error) return { error: error.message }
  }
  revalidateOps()
  return { ok: true }
}

export async function listRecurringJobs(): Promise<RecurringJob[]> {
  const profile = await requireProfile()
  if (!profile.organization_id) return []
  const { data, error } = await ops(supabaseAdmin, 'org_recurring_jobs')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .order('next_run_on')
  if (error) return []
  return (data ?? []) as RecurringJob[]
}

function addFrequency(dateStr: string, frequency: RecurringJob['frequency'], n: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  if (frequency === 'daily') d.setUTCDate(d.getUTCDate() + n)
  else if (frequency === 'weekly') d.setUTCDate(d.getUTCDate() + 7 * n)
  else d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().split('T')[0]
}

export async function runDueRecurringJobs(today = new Date().toISOString().split('T')[0]): Promise<number> {
  const { data: jobs, error } = await ops(supabaseAdmin, 'org_recurring_jobs')
    .select('*')
    .eq('is_active', true)
    .lte('next_run_on', today)
  if (error || !jobs?.length) return 0

  let created = 0
  for (const job of jobs as RecurringJob[]) {
    const orgId = (job as RecurringJob & { organization_id?: string }).organization_id
    if (!orgId || !job.assigned_to) continue

    const { data: tactic, error: tErr } = await supabaseAdmin
      .from('tactics')
      .insert({
        title: job.title,
        description: job.description,
        project_id: job.project_id,
        assigned_to: job.assigned_to,
        created_by: job.assigned_to,
        priority: job.priority,
        due_date: job.next_run_on,
        estimated_hours: job.estimated_hours,
        checklist_template_id: job.checklist_template_id,
        work_order_type_id: job.work_order_type_id,
        organization_id: orgId,
        status: 'assigned',
      })
      .select('id')
      .single()
    if (tErr || !tactic) continue

    await supabaseAdmin.from('tactic_assignees').insert({
      tactic_id: tactic.id,
      profile_id: job.assigned_to,
      organization_id: orgId,
    })

    if (job.checklist_template_id) {
      const { data: items } = await ops(supabaseAdmin, 'checklist_template_items')
        .select('*')
        .eq('template_id', job.checklist_template_id)
      if (items?.length) {
        await ops(supabaseAdmin, 'tactic_checklist_items').insert(
          items.map((item: { id: string; label: string; required: boolean; sort_order: number }) => ({
            organization_id: orgId,
            tactic_id: tactic.id,
            template_item_id: item.id,
            label: item.label,
            required: item.required,
            sort_order: item.sort_order,
          })),
        )
      }
    }

    await ops(supabaseAdmin, 'org_recurring_jobs')
      .update({
        last_run_on: job.next_run_on,
        next_run_on: addFrequency(job.next_run_on, job.frequency, job.interval_n),
      })
      .eq('id', job.id)
    created++
  }
  return created
}

export type PayrollRow = {
  employee_id: string
  employee_code: string
  full_name: string
  week_start: string
  week_end: string
  minutes: number
  overtime_minutes: number
  hourly_rate_cents: number
  regular_pay_cents: number
  overtime_pay_cents: number
}

export async function getPayrollExport(from: string, to: string): Promise<PayrollRow[]> {
  const profile = await requireRole(['admin', 'manager'])
  if (!profile.organization_id) return []

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('settings')
    .eq('id', profile.organization_id)
    .single()
  const settings = mergeWorkspaceSettings(org?.settings)
  const otCap = settings.time.overtimeWeeklyMinutes

  const supabase = await createClient()
  const { data: employees } = await supabase
    .from('profiles')
    .select('id, employee_code, full_name, timezone, hourly_rate_cents')
    .eq('status', 'active')
    .order('full_name')

  const ids = (employees ?? []).map((e) => e.id)
  if (!ids.length) return []

  const { data: logs } = await supabase
    .from('time_logs')
    .select('employee_id, log_date, duration_minutes')
    .in('employee_id', ids)
    .gte('log_date', from)
    .lte('log_date', to)
    .not('duration_minutes', 'is', null)

  const minutesByEmpWeek: Record<string, number> = {}
  for (const log of logs ?? []) {
    const emp = employees?.find((e) => e.id === log.employee_id)
    const tz = resolveTimezone(emp?.timezone)
    const weekStart = startOfWeekInTimezone(tz, new Date(`${log.log_date}T12:00:00`))
    const key = `${log.employee_id}|${weekStart}`
    minutesByEmpWeek[key] = (minutesByEmpWeek[key] ?? 0) + (log.duration_minutes ?? 0)
  }

  const rows: PayrollRow[] = []
  for (const emp of employees ?? []) {
    const tz = resolveTimezone(emp.timezone)
    const keys = Object.keys(minutesByEmpWeek).filter((k) => k.startsWith(emp.id + '|'))
    for (const key of keys) {
      const weekStart = key.split('|')[1]
      const minutes = minutesByEmpWeek[key]
      const overtime = Math.max(0, minutes - otCap)
      const regular = minutes - overtime
      const rate = emp.hourly_rate_cents ?? 0
      const otRate = Math.round(rate * 1.5)
      const weekEndDate = new Date(`${weekStart}T12:00:00Z`)
      weekEndDate.setUTCDate(weekEndDate.getUTCDate() + 6)
      rows.push({
        employee_id: emp.id,
        employee_code: emp.employee_code,
        full_name: emp.full_name,
        week_start: weekStart,
        week_end: weekEndDate.toISOString().split('T')[0],
        minutes,
        overtime_minutes: overtime,
        hourly_rate_cents: rate,
        regular_pay_cents: Math.round((regular / 60) * rate),
        overtime_pay_cents: Math.round((overtime / 60) * otRate),
      })
    }
    void tz
  }
  return rows.sort((a, b) => a.full_name.localeCompare(b.full_name) || a.week_start.localeCompare(b.week_start))
}

export type LiveWorker = {
  id: string
  full_name: string
  employee_code: string
  clock_in_at: string
  log_date: string
}

export async function listWhoIsWorking(): Promise<LiveWorker[]> {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('time_logs')
    .select(`
      clock_in_at, log_date,
      employee:profiles!time_logs_employee_id_fkey(id, full_name, employee_code, status)
    `)
    .is('clock_out_at', null)
    .order('clock_in_at')

  return (data ?? [])
    .map((row) => {
      const emp = row.employee as unknown as LiveWorker & { status?: string } | null
      if (!emp || emp.status === 'inactive') return null
      return {
        id: emp.id,
        full_name: emp.full_name,
        employee_code: emp.employee_code,
        clock_in_at: row.clock_in_at,
        log_date: row.log_date,
      }
    })
    .filter((v): v is LiveWorker => !!v)
}

export type JobCostSummary = {
  hours: number
  estimatedHours: number | null
  rateCents: number
  costCents: number
  billable: boolean
}

export async function getTacticJobCost(tacticId: string): Promise<JobCostSummary | null> {
  const profile = await requireProfile()
  if (!profile.organization_id) return null
  const supabase = await createClient()
  const { data: tactic } = await supabase
    .from('tactics')
    .select('id, estimated_hours, billable, assigned_to')
    .eq('id', tacticId)
    .eq('organization_id', profile.organization_id)
    .single()
  if (!tactic) return null

  const { data: logs } = await supabase
    .from('activity_logs')
    .select('hours_logged')
    .eq('tactic_id', tacticId)
    .not('hours_logged', 'is', null)

  const hours = (logs ?? []).reduce((s, l) => s + (l.hours_logged ?? 0), 0)
  const { data: assignee } = await supabase
    .from('profiles')
    .select('hourly_rate_cents')
    .eq('id', tactic.assigned_to)
    .maybeSingle()
  const rateCents = assignee?.hourly_rate_cents ?? 0
  return {
    hours,
    estimatedHours: tactic.estimated_hours,
    rateCents,
    costCents: Math.round(hours * rateCents),
    billable: tactic.billable !== false,
  }
}

export async function getOverdueFollowUpCount(): Promise<number> {
  const profile = await requireProfile()
  if (!profile.organization_id) return 0
  const tz = resolveTimezone(profile.timezone)
  const today = todayInTimezone(tz)
  const { count, error } = await ops(supabaseAdmin, 'lead_follow_ups')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)
    .is('completed_at', null)
    .lte('due_on', today)
  if (error) return 0
  return count ?? 0
}

export async function getExpiringComplianceCount(withinDays = 30): Promise<number> {
  const profile = await requireProfile()
  if (!profile.organization_id) return 0
  const tz = resolveTimezone(profile.timezone)
  const today = todayInTimezone(tz)
  const until = new Date(`${today}T12:00:00Z`)
  until.setUTCDate(until.getUTCDate() + withinDays)
  const { count, error } = await ops(supabaseAdmin, 'compliance_records')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', profile.organization_id)
    .lte('expires_on', until.toISOString().split('T')[0])
    .gte('expires_on', today)
  if (error) return 0
  return count ?? 0
}
