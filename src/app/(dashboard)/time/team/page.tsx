import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { closeStaleSessionsForEmployees } from '@/lib/actions/time'
import { TeamTimeTable, type EmployeeTimeStats } from '@/components/time/TeamTimeTable'
import {
  startOfMonthInTimezone,
  startOfWeekInTimezone,
  todayInTimezone,
} from '@/lib/utils/dates'
import { resolveTimezone } from '@/lib/utils/timezones'

export const metadata = { title: 'Team Time — WSSO' }

export default async function TeamTimePage() {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  const supabase = await createClient()

  const { data: employees } = await supabase
    .from('profiles')
    .select('id, employee_code, full_name, team_id, status, timezone')
    .eq('status', 'active')
    .order('full_name')

  const employeeIds = (employees ?? []).map((e) => e.id)

  try {
    await closeStaleSessionsForEmployees(employeeIds)
  } catch (err) {
    console.error('[TeamTimePage] closeStaleSessionsForEmployees failed:', err)
  }

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Team Time</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {profile.role === 'manager'
            ? 'Attendance overview for your team members this month.'
            : 'Attendance overview across all active employees this month.'}
          {' '}Today/week totals use each employee&apos;s timezone.
        </p>
      </div>

      <TeamTimeTable employees={employeeStats} isAdmin={profile.role === 'admin'} />
    </div>
  )
}
