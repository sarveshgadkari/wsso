'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth/session'
import { todayInTimezone } from '@/lib/utils/dates'
import { resolveTimezone, timezoneShortLabel } from '@/lib/utils/timezones'
import type {
  DailyTimeRow, WeeklyTimeRow, PerformanceRow,
  ProjectProgressRow, WorkOrderRow,
} from '@/components/reports/report-types'

// ── helpers ────────────────────────────────────────────────────────────────────

function toMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().split('T')[0]
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

async function viewerToday(): Promise<string> {
  const profile = await requireRole(['admin', 'manager'])
  return todayInTimezone(resolveTimezone(profile.timezone))
}

// ── Raw Supabase row shapes ────────────────────────────────────────────────────

interface RawProfile {
  id:            string
  full_name:     string
  employee_code: string
  timezone:      string | null
}

interface RawTimeLogRow {
  employee_id:      string
  log_date:         string
  clock_in_at:      string
  clock_out_at:     string | null
  duration_minutes: number | null
}

function logMinutes(l: RawTimeLogRow): number {
  if (l.duration_minutes != null) return l.duration_minutes
  if (!l.clock_out_at) {
    return Math.max(
      0,
      Math.floor((Date.now() - new Date(l.clock_in_at).getTime()) / 60_000),
    )
  }
  return 0
}


interface RawProject {
  id:     string
  code:   string
  name:   string
  status: string
}

interface RawTacticForProject {
  project_id:      string | null
  status:          string
  estimated_hours: number | null
}

interface RawActivityLog {
  hours_logged: number | null
  tactic: { project_id: string | null } | null
}

interface RawWorkOrderTactic {
  id:              string
  code:            string
  title:           string
  status:          string
  priority:        string
  due_date:        string | null
  estimated_hours: number | null
  created_at:      string
  assignee: { full_name: string } | null
  project:  { name: string }       | null
}

// ── Report 1: Daily Time ───────────────────────────────────────────────────────

export async function getDailyTimeReport(date: string): Promise<DailyTimeRow[]> {
  await requireRole(['admin', 'manager'])
  const supabase = await createClient()

  const [profilesRes, logsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, employee_code, timezone')
      .eq('status', 'active')
      .order('full_name'),
    supabase
      .from('time_logs')
      .select('employee_id, log_date, clock_in_at, clock_out_at, duration_minutes')
      .eq('log_date', date),
  ])

  const profiles = (profilesRes.data ?? []) as RawProfile[]
  const logs     = (logsRes.data     ?? []) as RawTimeLogRow[]

  const minuteMap: Record<string, number> = {}
  logs.forEach(l => {
    const mins = logMinutes(l)
    if (mins > 0) {
      minuteMap[l.employee_id] = (minuteMap[l.employee_id] ?? 0) + mins
    }
  })

  return profiles.map(p => ({
    id:            p.id,
    full_name:     p.full_name,
    employee_code: p.employee_code,
    timezone:      timezoneShortLabel(resolveTimezone(p.timezone)),
    minutes:       minuteMap[p.id] ?? 0,
  }))
}

// ── Report 2: Weekly Time ──────────────────────────────────────────────────────

export async function getWeeklyTimeReport(weekStartRaw: string): Promise<{
  rows: WeeklyTimeRow[]
  weekStart: string
  weekDates: string[]
}> {
  await requireRole(['admin', 'manager'])
  const supabase  = await createClient()
  const weekStart = toMonday(weekStartRaw)
  const weekEnd   = addDays(weekStart, 6)
  const dates     = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const [profilesRes, logsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, employee_code, timezone')
      .eq('status', 'active')
      .order('full_name'),
    supabase
      .from('time_logs')
      .select('employee_id, log_date, clock_in_at, clock_out_at, duration_minutes')
      .gte('log_date', weekStart)
      .lte('log_date', weekEnd),
  ])

  const profiles = (profilesRes.data ?? []) as RawProfile[]
  const logs     = (logsRes.data     ?? []) as RawTimeLogRow[]

  const map: Record<string, Record<string, number>> = {}
  logs.forEach(l => {
    const mins = logMinutes(l)
    if (mins <= 0) return
    if (!map[l.employee_id]) map[l.employee_id] = {}
    map[l.employee_id][l.log_date] = (map[l.employee_id][l.log_date] ?? 0) + mins
  })

  const rows: WeeklyTimeRow[] = profiles.map(p => {
    const days  = map[p.id] ?? {}
    const total = dates.reduce((s, d) => s + (days[d] ?? 0), 0)
    return {
      id:            p.id,
      full_name:     p.full_name,
      employee_code: p.employee_code,
      timezone:      timezoneShortLabel(resolveTimezone(p.timezone)),
      days,
      total,
    }
  })

  return { rows, weekStart, weekDates: dates }
}

// ── Report 3: Employee Performance ────────────────────────────────────────────

export async function getEmployeePerformanceReport(
  from: string,
  to:   string,
): Promise<PerformanceRow[]> {
  await requireRole(['admin', 'manager'])
  const supabase = await createClient()
  const today    = await viewerToday()
  const toEnd    = `${to}T23:59:59.999Z`

  const [profilesRes, assignedRes, completedRes, overdueRes, hoursRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, employee_code, timezone')
      .eq('status', 'active')
      .order('full_name'),
    // All non-archived tactics (current workload)
    supabase.from('tactics')
      .select('assigned_to')
      .neq('status', 'archived'),
    // Completed in the selected range — using updated_at as proxy for done_at
    supabase.from('tactics')
      .select('assigned_to, created_at, updated_at')
      .eq('status', 'done')
      .gte('updated_at', from)
      .lte('updated_at', toEnd),
    // Currently overdue (not done/archived)
    supabase.from('tactics')
      .select('assigned_to')
      .lt('due_date', today)
      .neq('status', 'done')
      .neq('status', 'archived'),
    // Clock hours in the range (includes open sessions via logMinutes)
    supabase.from('time_logs')
      .select('employee_id, log_date, clock_in_at, clock_out_at, duration_minutes')
      .gte('log_date', from)
      .lte('log_date', to),
  ])

  const profiles  = (profilesRes.data  ?? []) as RawProfile[]
  const assigned  = (assignedRes.data  ?? []) as { assigned_to: string }[]
  const completed = (completedRes.data ?? []) as { assigned_to: string; created_at: string; updated_at: string }[]
  const overdue   = (overdueRes.data   ?? []) as { assigned_to: string }[]
  const hours     = (hoursRes.data     ?? []) as RawTimeLogRow[]

  const MS_PER_DAY = 1000 * 60 * 60 * 24

  // Aggregate maps
  const assignedMap:   Record<string, number> = {}
  const completedMap:  Record<string, number> = {}
  const overdueMap:    Record<string, number> = {}
  const clockMinMap:   Record<string, number> = {}
  const completionDays: Record<string, number[]> = {}

  assigned.forEach(t  => { assignedMap[t.assigned_to]  = (assignedMap[t.assigned_to]  ?? 0) + 1 })
  overdue.forEach(t   => { overdueMap[t.assigned_to]   = (overdueMap[t.assigned_to]   ?? 0) + 1 })
  hours.forEach(l => {
    const mins = logMinutes(l)
    if (mins > 0) {
      clockMinMap[l.employee_id] = (clockMinMap[l.employee_id] ?? 0) + mins
    }
  })
  completed.forEach(t => {
    completedMap[t.assigned_to] = (completedMap[t.assigned_to] ?? 0) + 1
    const days = (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / MS_PER_DAY
    if (!completionDays[t.assigned_to]) completionDays[t.assigned_to] = []
    completionDays[t.assigned_to].push(Math.max(0, days))
  })

  return profiles.map(p => {
    const daysArr = completionDays[p.id]
    const avg     = daysArr && daysArr.length > 0
      ? Math.round((daysArr.reduce((s, d) => s + d, 0) / daysArr.length) * 10) / 10
      : null
    return {
      id:                  p.id,
      full_name:           p.full_name,
      employee_code:       p.employee_code,
      timezone:            timezoneShortLabel(resolveTimezone(p.timezone)),
      assigned:            assignedMap[p.id]  ?? 0,
      completed:           completedMap[p.id] ?? 0,
      overdue:             overdueMap[p.id]   ?? 0,
      avg_completion_days: avg,
      clock_hours:         Math.round(((clockMinMap[p.id] ?? 0) / 60) * 10) / 10,
    }
  })
}

// ── Report 4: Project Progress ─────────────────────────────────────────────────

export async function getProjectProgressReport(
  statusFilter?: string,
): Promise<ProjectProgressRow[]> {
  await requireRole(['admin', 'manager'])
  const supabase = await createClient()

  let projectQuery = supabase.from('projects').select('id, code, name, status').order('name')
  if (statusFilter && statusFilter !== 'all') {
    projectQuery = projectQuery.eq('status', statusFilter)
  }

  const [projectsRes, tacticsRes, hoursRes] = await Promise.all([
    projectQuery,
    supabase.from('tactics')
      .select('project_id, status, estimated_hours')
      .not('project_id', 'is', null),
    supabase.from('activity_logs')
      .select('hours_logged, tactic:tactics!activity_logs_tactic_id_fkey(project_id)')
      .not('hours_logged', 'is', null),
  ])

  const projects = (projectsRes.data ?? []) as RawProject[]
  const tactics  = (tacticsRes.data  ?? []) as RawTacticForProject[]
  const actLogs  = (hoursRes.data    ?? []) as unknown as RawActivityLog[]

  // Aggregate per project
  const tacticsByProject: Record<string, { total: number; done: number; est_hours: number }> = {}
  tactics.forEach(t => {
    if (!t.project_id) return
    if (!tacticsByProject[t.project_id]) tacticsByProject[t.project_id] = { total: 0, done: 0, est_hours: 0 }
    const rec = tacticsByProject[t.project_id]
    if (t.status !== 'archived') rec.total++
    if (t.status === 'done')     rec.done++
    if (t.estimated_hours)       rec.est_hours += t.estimated_hours
  })

  const hoursByProject: Record<string, number> = {}
  actLogs.forEach(l => {
    const pid = l.tactic?.project_id
    if (pid && l.hours_logged) {
      hoursByProject[pid] = (hoursByProject[pid] ?? 0) + l.hours_logged
    }
  })

  return projects.map(p => {
    const t = tacticsByProject[p.id] ?? { total: 0, done: 0, est_hours: 0 }
    const pct = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0
    return {
      id:              p.id,
      code:            p.code,
      name:            p.name,
      status:          p.status,
      total_tactics:   t.total,
      done_tactics:    t.done,
      pct_complete:    pct,
      estimated_hours: Math.round(t.est_hours * 10) / 10,
      logged_hours:    Math.round((hoursByProject[p.id] ?? 0) * 10) / 10,
    }
  })
}

// ── Report 5: Work Orders ──────────────────────────────────────────────────────

export async function getWorkOrdersReport(params: {
  status?:     string
  project_id?: string
  from?:       string
  to?:         string
}): Promise<WorkOrderRow[]> {
  await requireRole(['admin', 'manager'])
  const supabase = await createClient()
  const today    = await viewerToday()

  let q = supabase.from('tactics').select(`
    id, code, title, status, priority, due_date, estimated_hours, created_at,
    assignee:profiles!tactics_assigned_to_fkey(full_name),
    project:projects!tactics_project_id_fkey(name)
  `).order('created_at', { ascending: false })

  const { status, project_id, from, to } = params

  if (status === 'open') {
    q = q.in('status', ['assigned', 'in_progress'])
  } else if (status === 'review') {
    q = q.eq('status', 'review')
  } else if (status === 'done') {
    q = q.eq('status', 'done')
  } else if (status === 'archived') {
    q = q.eq('status', 'archived')
  } else if (status === 'overdue') {
    q = q.lt('due_date', today).neq('status', 'done').neq('status', 'archived')
  }
  // 'all': no status filter

  if (project_id) q = q.eq('project_id', project_id)
  if (from)       q = q.gte('created_at', from)
  if (to)         q = q.lte('created_at', `${to}T23:59:59.999Z`)

  const { data } = await q
  const rows = (data ?? []) as unknown as RawWorkOrderTactic[]

  return rows.map(t => ({
    id:              t.id,
    code:            t.code,
    title:           t.title,
    status:          t.status as WorkOrderRow['status'],
    priority:        t.priority as WorkOrderRow['priority'],
    due_date:        t.due_date,
    assignee_name:   t.assignee?.full_name ?? '—',
    project_name:    t.project?.name ?? null,
    estimated_hours: t.estimated_hours,
    created_at:      t.created_at,
  }))
}

// ── Projects list for Work Orders filter ──────────────────────────────────────

export async function getProjectOptions(): Promise<{ id: string; name: string; code: string }[]> {
  await requireRole(['admin', 'manager'])
  const supabase = await createClient()
  const { data } = await supabase
    .from('projects')
    .select('id, name, code')
    .eq('status', 'active')
    .order('name')
  return (data ?? []) as { id: string; name: string; code: string }[]
}
