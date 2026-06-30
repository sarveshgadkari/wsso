import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TimeLogTable, formatDuration } from '@/components/time/TimeLogTable'
import { WeeklyChart, type DayBar } from '@/components/time/WeeklyChart'

interface Props {
  params: { employeeId: string }
}

export async function generateMetadata() {
  return { title: 'Employee Time — WSSO' }
}

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

function last7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return isoDate(d)
  })
}

export default async function EmployeeTimePage({ params }: Props) {
  const viewer = await requireProfile()
  if (!['admin', 'manager'].includes(viewer.role)) redirect('/dashboard')

  const supabase = await createClient()

  // RLS: if manager tries to access an employee outside their team, this returns null
  const { data: employee } = await supabase
    .from('profiles')
    .select('id, full_name, employee_code, role')
    .eq('id', params.employeeId)
    .single()

  if (!employee) notFound()

  const thirtyAgo = new Date()
  thirtyAgo.setDate(thirtyAgo.getDate() - 30)

  const { data: logs } = await supabase
    .from('time_logs')
    .select('*')
    .eq('employee_id', params.employeeId)
    .gte('clock_in_at', thirtyAgo.toISOString())
    .order('clock_in_at', { ascending: false })

  const allLogs  = logs ?? []
  const today    = isoDate(new Date())
  const weekStart = startOfWeekISO()

  const todayMinutes = allLogs
    .filter((l) => l.log_date === today && l.duration_minutes != null)
    .reduce((s, l) => s + (l.duration_minutes ?? 0), 0)

  const weekMinutes = allLogs
    .filter((l) => l.log_date && l.log_date >= weekStart && l.duration_minutes != null)
    .reduce((s, l) => s + (l.duration_minutes ?? 0), 0)

  const minutesByDate: Record<string, number> = {}
  allLogs.forEach((l) => {
    if (l.log_date && l.duration_minutes) {
      minutesByDate[l.log_date] = (minutesByDate[l.log_date] ?? 0) + l.duration_minutes
    }
  })

  const chartData: DayBar[] = last7Days().map((date) => ({
    label: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
    date,
    hours: Math.round(((minutesByDate[date] ?? 0) / 60) * 10) / 10,
  }))

  const isAdmin = viewer.role === 'admin'

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
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
        <TimeLogTable logs={allLogs} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
