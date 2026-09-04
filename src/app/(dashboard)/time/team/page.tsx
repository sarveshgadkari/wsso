import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { closeStaleSessionsForEmployees } from '@/lib/actions/time'
import { TeamTimeTable, type EmployeeTimeStats } from '@/components/time/TeamTimeTable'
import { PendingNotesPanel, type PendingNoteRow } from '@/components/time/PendingNotesPanel'
import {
  startOfMonthInTimezone,
  startOfWeekInTimezone,
  todayInTimezone,
} from '@/lib/utils/dates'
import { resolveTimezone } from '@/lib/utils/timezones'
import { PayrollExportButton } from '@/components/ops/PayrollExportButton'
import { WhoIsWorkingCard } from '@/components/ops/WhoIsWorkingCard'
import { listWhoIsWorking } from '@/lib/actions/ops'
import { applyManagerProfileFilter, managerScope } from '@/lib/saas/team-scope'
import { requireOrgId } from '@/lib/saas/tenant'

export const metadata = { title: 'Team Time — WSSO' }

export default async function TeamTimePage() {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  const supabase = await createClient()
  const orgId = requireOrgId(profile)
  const scope = await managerScope(profile)

  const { data: employees } = await applyManagerProfileFilter(
    supabase
      .from('profiles')
      .select('id, employee_code, full_name, team_id, status, timezone')
      .eq('status', 'active')
      .eq('organization_id', orgId)
      .order('full_name'),
    scope,
  )

  const employeeIds = (employees ?? []).map((e) => e.id)

  try {
    await closeStaleSessionsForEmployees(employeeIds)
  } catch (err) {
    console.error('[TeamTimePage] closeStaleSessionsForEmployees failed:', err)
  }

  const pendingNotesQuery = supabase
    .from('time_logs')
    .select(`
      id, log_date, clock_in_note, clock_in_note_status, clock_out_note, clock_out_note_status,
      employee:profiles!time_logs_employee_id_fkey(id, full_name, employee_code)
    `)
    .or('clock_in_note_status.eq.pending,clock_out_note_status.eq.pending')
    .order('log_date', { ascending: false })

  const { data: pendingNoteLogs } = employeeIds.length
    ? await pendingNotesQuery.in('employee_id', employeeIds)
    : { data: [] }

  const pendingNotes: PendingNoteRow[] = []
  ;(pendingNoteLogs ?? []).forEach((l) => {
    const emp = l.employee as unknown as { id: string; full_name: string; employee_code: string } | null
    if (!emp) return
    if (l.clock_in_note_status === 'pending' && l.clock_in_note) {
      pendingNotes.push({
        timeLogId: l.id, employeeName: emp.full_name, employeeCode: emp.employee_code,
        logDate: l.log_date, field: 'clock_in', note: l.clock_in_note,
      })
    }
    if (l.clock_out_note_status === 'pending' && l.clock_out_note) {
      pendingNotes.push({
        timeLogId: l.id, employeeName: emp.full_name, employeeCode: emp.employee_code,
        logDate: l.log_date, field: 'clock_out', note: l.clock_out_note,
      })
    }
  })

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')

  const teamMap = Object.fromEntries((teams ?? []).map((t) => [t.id, t.name]))

  const tzByEmployee: Record<string, string> = {}
  ;(employees ?? []).forEach((e) => {
    tzByEmployee[e.id] = resolveTimezone(e.timezone)
  })

  const monthStarts = employeeIds.map((id) => startOfMonthInTimezone(tzByEmployee[id]))
  const monthStart  = monthStarts.length ? monthStarts.sort()[0] : startOfMonthInTimezone('UTC')

  const { data: logs } = employeeIds.length
    ? await supabase
        .from('time_logs')
        .select('id, employee_id, log_date, duration_minutes, closed_reason, clock_out_at, clock_in_at')
        .in('employee_id', employeeIds)
        .gte('log_date', monthStart)
    : { data: [] }

  const agg: Record<string, {
    today: number; week: number; month: number
    autoLogouts: number; isActiveNow: boolean
    openSession: { id: string; clock_in_at: string } | null
  }> = {}

  ;(logs ?? []).forEach((l) => {
    if (!agg[l.employee_id]) {
      agg[l.employee_id] = {
        today: 0, week: 0, month: 0,
        autoLogouts: 0, isActiveNow: false, openSession: null,
      }
    }
    const a    = agg[l.employee_id]
    const mins = l.duration_minutes ?? 0
    const tz   = tzByEmployee[l.employee_id]
    const empToday     = todayInTimezone(tz)
    const empWeekStart = startOfWeekInTimezone(tz)

    if (l.log_date === empToday)                  a.today += mins
    if (l.log_date && l.log_date >= empWeekStart) a.week  += mins
    a.month += mins

    if (l.closed_reason === 'auto_logout') a.autoLogouts++
    if (!l.clock_out_at) {
      a.isActiveNow = true
      a.openSession = { id: l.id, clock_in_at: l.clock_in_at }
    }
  })

  const employeeStats: EmployeeTimeStats[] = (employees ?? []).map((e) => ({
    id:            e.id,
    employee_code: e.employee_code,
    full_name:     e.full_name,
    team_name:     e.team_id ? (teamMap[e.team_id] ?? null) : null,
    todayMinutes:  agg[e.id]?.today       ?? 0,
    weekMinutes:   agg[e.id]?.week        ?? 0,
    monthMinutes:  agg[e.id]?.month       ?? 0,
    autoLogouts:   agg[e.id]?.autoLogouts ?? 0,
    isActiveNow:   agg[e.id]?.isActiveNow ?? false,
    openSession:   agg[e.id]?.openSession ?? null,
  }))

  const liveWorkers = await listWhoIsWorking()
  const monthStartForExport = startOfMonthInTimezone(resolveTimezone(profile.timezone))
  const todayForExport = todayInTimezone(resolveTimezone(profile.timezone))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Team Time</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {profile.role === 'manager'
              ? 'Attendance overview for your team members this month.'
              : 'Attendance overview across all active employees this month.'}
            {' '}Today/week totals use each employee&apos;s timezone. Overtime in the CSV uses your workspace weekly cap.
          </p>
        </div>
        {profile.role === 'admin' && (
          <PayrollExportButton defaultFrom={monthStartForExport} defaultTo={todayForExport} />
        )}
      </div>

      <WhoIsWorkingCard workers={liveWorkers} />

      <PendingNotesPanel notes={pendingNotes} />

      <TeamTimeTable employees={employeeStats} isAdmin={profile.role === 'admin'} />
    </div>
  )
}
