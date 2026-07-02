import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { closeStaleSessionsForEmployees } from '@/lib/actions/time'
import { TimeLogTable } from '@/components/time/TimeLogTable'
import { WeeklyChart, type DayBar } from '@/components/time/WeeklyChart'
import { formatDuration } from '@/lib/utils/time-format'
import { ForceClockOutButton } from '@/components/time/ForceClockOutButton'
import {
  todayInTimezone,
  startOfWeekInTimezone,
  last7Days,
  dayLabel,
} from '@/lib/utils/dates'
import { resolveTimezone } from '@/lib/utils/timezones'

function liveMinutes(l: {
  duration_minutes: number | null
  clock_out_at: string | null
  clock_in_at: string
}): number {
  if (l.duration_minutes != null) return l.duration_minutes
  if (!l.clock_out_at) {
    return Math.max(
      0,
      Math.floor((Date.now() - new Date(l.clock_in_at).getTime()) / 60_000),
    )
  }
  return 0
}

interface Props {
  params: { employeeId: string }
}

export async function generateMetadata() {
  return { title: 'Employee Time — WSSO' }
}

export default async function EmployeeTimePage({ params }: Props) {
  const viewer = await requireProfile()
  if (!['admin', 'manager'].includes(viewer.role)) redirect('/dashboard')

  const supabase = await createClient()

  // RLS: if manager tries to access an employee outside their team, this returns null
  const { data: employee } = await supabase
    .from('profiles')
    .select('id, full_name, employee_code, role, timezone')
    .eq('id', params.employeeId)
    .single()

  if (!employee) notFound()

  try {
    await closeStaleSessionsForEmployees([params.employeeId])
  } catch (err) {
    console.error('[EmployeeTimePage] closeStaleSessionsForEmployees failed:', err)
  }

  const tz = resolveTimezone(employee.timezone)

  const thirtyAgo = new Date()
  thirtyAgo.setDate(thirtyAgo.getDate() - 30)

  const [{ data: logs }, { data: openSession }] = await Promise.all([
    supabase
      .from('time_logs')
      .select('*')
      .eq('employee_id', params.employeeId)
      .gte('clock_in_at', thirtyAgo.toISOString())
      .order('clock_in_at', { ascending: false }),
    supabase
      .from('time_logs')
      .select('id, clock_in_at')
      .eq('employee_id', params.employeeId)
      .is('clock_out_at', null)
      .maybeSingle(),
  ])

  const allLogs  = logs ?? []
  const today    = todayInTimezone(tz)
  const weekStart = startOfWeekInTimezone(tz)

  const todayMinutes = allLogs
    .filter((l) => l.log_date === today)
    .reduce((s, l) => s + liveMinutes(l), 0)

  const weekMinutes = allLogs
    .filter((l) => l.log_date && l.log_date >= weekStart)
    .reduce((s, l) => s + liveMinutes(l), 0)

  const minutesByDate: Record<string, number> = {}
  allLogs.forEach((l) => {
    if (l.log_date) {
      minutesByDate[l.log_date] = (minutesByDate[l.log_date] ?? 0) + liveMinutes(l)
    }
  })

  const chartData: DayBar[] = last7Days(today).map((date) => ({
    label: dayLabel(date),
    date,
    hours: Math.round(((minutesByDate[date] ?? 0) / 60) * 10) / 10,
  }))

  const isAdmin = viewer.role === 'admin'

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/time/team"
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Team Time
          </Link>
          <span className="text-neutral-300">/</span>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">{employee.full_name}</h2>
            <p className="font-mono text-xs text-neutral-400">{employee.employee_code}</p>
          </div>
        </div>

        {isAdmin && openSession && (
          <ForceClockOutButton
            employeeId={params.employeeId}
            timeLogId={openSession.id}
            clockInAt={openSession.clock_in_at}
          />
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Today</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">
            {todayMinutes > 0 ? formatDuration(todayMinutes) : '—'}
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">This week</p>
          <p className="mt-1 text-2xl font-bold text-neutral-900">
            {weekMinutes > 0 ? formatDuration(weekMinutes) : '—'}
          </p>
        </div>
      </div>

      <WeeklyChart data={chartData} />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">Recent sessions</h3>
        <TimeLogTable logs={allLogs} isAdmin={isAdmin} timeZone={tz} />
      </div>
    </div>
  )
}
