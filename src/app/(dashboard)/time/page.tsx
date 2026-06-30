import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TimeLogTable } from '@/components/time/TimeLogTable'
import { WeeklyChart, type DayBar } from '@/components/time/WeeklyChart'
import { formatDuration } from '@/components/time/TimeLogTable'

export const metadata = { title: 'My Time — WSSO' }

// Date helpers (server-side, no locale magic needed)
function isoDate(d: Date) {
  return d.toISOString().split('T')[0]
}

function startOfWeekISO(): string {
  const d = new Date()
  const day = d.getDay() // 0=Sun
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)) // Monday
  d.setHours(0, 0, 0, 0)
  return isoDate(d)
}


function last7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return isoDate(d)
  })
}

export default async function MyTimePage() {
  const profile = await requireProfile()
  const supabase = await createClient()

  // Fetch last 30 days of sessions (open + closed)
  const thirtyAgo = new Date()
  thirtyAgo.setDate(thirtyAgo.getDate() - 30)

  const { data: logs } = await supabase
    .from('time_logs')
    .select('*')
    .eq('employee_id', profile.id)
    .gte('clock_in_at', thirtyAgo.toISOString())
    .order('clock_in_at', { ascending: false })

  const allLogs = logs ?? []

  const today     = isoDate(new Date())
  const weekStart = startOfWeekISO()

  const todayMinutes = allLogs
    .filter((l) => l.log_date === today && l.duration_minutes != null)
    .reduce((s, l) => s + (l.duration_minutes ?? 0), 0)

  const weekMinutes = allLogs
    .filter((l) => l.log_date && l.log_date >= weekStart && l.duration_minutes != null)
    .reduce((s, l) => s + (l.duration_minutes ?? 0), 0)

  // Build chart data: last 7 days
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

  const isAdmin = profile.role === 'admin'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">My Time</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Your personal clock-in history and weekly overview.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
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

      {/* Weekly bar chart */}
      <WeeklyChart data={chartData} />

      {/* Session table */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">Recent sessions</h3>
        <TimeLogTable logs={allLogs} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
