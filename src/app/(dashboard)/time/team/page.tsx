import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TeamTimeTable, type EmployeeTimeStats } from '@/components/time/TeamTimeTable'

export const metadata = { title: 'Team Time — WSSO' }

function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function startOfWeekISO(): string {
  const d = new Date()
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return isoDate(d)
}

function startOfMonthISO(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return isoDate(d)
}

export default async function TeamTimePage() {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  const supabase = await createClient()

  // Profiles are RLS-scoped: manager sees own team, admin sees all
  const { data: employees } = await supabase
    .from('profiles')
    .select('id, employee_code, full_name, team_id, status')
    .eq('status', 'active')
    .order('full_name')

  const employeeIds = (employees ?? []).map((e) => e.id)

  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')

  const teamMap = Object.fromEntries((teams ?? []).map((t) => [t.id, t.name]))

  const monthStart = startOfMonthISO()
  const today      = isoDate(new Date())
  const weekStart  = startOfWeekISO()

  const { data: logs } = employeeIds.length
    ? await supabase
        .from('time_logs')
        .select('id, employee_id, log_date, duration_minutes, closed_reason, clock_out_at')
        .in('employee_id', employeeIds)
        .gte('log_date', monthStart)
    : { data: [] }

  // Aggregate per employee
  const agg: Record<string, {
    today: number; week: number; month: number
    autoLogouts: number; isActiveNow: boolean
  }> = {}

  ;(logs ?? []).forEach((l) => {
    if (!agg[l.employee_id]) {
      agg[l.employee_id] = { today: 0, week: 0, month: 0, autoLogouts: 0, isActiveNow: false }
    }
    const a = agg[l.employee_id]
    const mins = l.duration_minutes ?? 0

    if (l.log_date === today)                    a.today += mins
    if (l.log_date && l.log_date >= weekStart)   a.week  += mins
    a.month += mins

    if (l.closed_reason === 'auto_logout') a.autoLogouts++
    if (!l.clock_out_at)                   a.isActiveNow = true
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
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Team Time</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {profile.role === 'manager'
            ? 'Attendance overview for your team members this month.'
            : 'Attendance overview across all active employees this month.'}
        </p>
      </div>

      <TeamTimeTable employees={employeeStats} isAdmin={profile.role === 'admin'} />
    </div>
  )
}
