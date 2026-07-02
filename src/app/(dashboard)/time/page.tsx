import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TimeLogTable } from '@/components/time/TimeLogTable'
import { WeeklyChart, type DayBar } from '@/components/time/WeeklyChart'
import { formatDuration } from '@/lib/utils/time-format'
import {
  todayInTimezone,
  startOfWeekInTimezone,
  last7Days,
  dayLabel,
} from '@/lib/utils/dates'
import { resolveTimezone, timezoneShortLabel, timezoneDisplayLabel, formatTimeInTimezone } from '@/lib/utils/timezones'
import { Globe } from 'lucide-react'

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

  const isAdmin = profile.role === 'admin'
  const tzShort = timezoneShortLabel(tz)
  const localTime = formatTimeInTimezone(tz)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">My Time</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Your personal clock-in history and weekly overview.
          </p>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50">
            <Globe className="h-4 w-4 text-primary-600" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Your timezone</p>
            <p className="text-sm font-semibold text-neutral-900">
              {tzShort}
              <span className="ml-1.5 font-normal text-neutral-500">· {localTime} now</span>
            </p>
            <p className="truncate text-xs text-neutral-400">{timezoneDisplayLabel(tz)}</p>
          </div>
        </div>
      </div>

      <p className="-mt-3 text-xs text-neutral-400">
        Today, this week, and session clock times use your assigned timezone ({tzShort}).
      </p>

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
        <TimeLogTable logs={allLogs} isAdmin={isAdmin} timeZone={tz} />
      </div>
    </div>
  )
}
