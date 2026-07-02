import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TimeLogTable } from '@/components/time/TimeLogTable'
import { WeeklyChart, type DayBar } from '@/components/time/WeeklyChart'
import { formatDuration } from '@/components/time/TimeLogTable'
import {
  todayInTimezone,
  startOfWeekInTimezone,
  last7Days,
  dayLabel,
} from '@/lib/utils/dates'
import { resolveTimezone } from '@/lib/utils/timezones'

export const metadata = { title: 'My Time — WSSO' }

export default async function MyTimePage() {
  const profile  = await requireProfile()
  const tz       = resolveTimezone(profile.timezone)
  const supabase = await createClient()

  const thirtyAgo = new Date()
  thirtyAgo.setDate(thirtyAgo.getDate() - 30)

  const { data: logs } = await supabase
    .from('time_logs')
    .select('*')
    .eq('employee_id', profile.id)
    .gte('clock_in_at', thirtyAgo.toISOString())
    .order('clock_in_at', { ascending: false })

  const allLogs = logs ?? []

  const today     = todayInTimezone(tz)
  const weekStart = startOfWeekInTimezone(tz)

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

  const chartData: DayBar[] = last7Days(today).map((date) => ({
    label: dayLabel(date),
    date,
    hours: Math.round(((minutesByDate[date] ?? 0) / 60) * 10) / 10,
  }))

  const isAdmin = profile.role === 'admin'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">My Time</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Your personal clock-in history and weekly overview
          ({TIMEZONE_LABEL(tz)}).
        </p>
      </div>

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

      <WeeklyChart data={chartData} />

      <div>
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">Recent sessions</h3>
        <TimeLogTable logs={allLogs} isAdmin={isAdmin} />
      </div>
    </div>
  )
}

function TIMEZONE_LABEL(tz: string): string {
  if (tz === 'Asia/Kolkata') return 'IST'
  if (tz === 'America/Chicago') return 'CST'
  return tz
}
