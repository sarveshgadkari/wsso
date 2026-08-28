import { getProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { autoClockOutAt, todayInTimezone } from '@/lib/utils/dates'
import { resolveTimezone } from '@/lib/utils/timezones'
import { closeOpenSessionsPastMidnight } from '@/lib/time/auto-close'
import { ClockWidgetUI } from './ClockWidgetUI'

export async function ClockWidget() {
  const profile = await getProfile()
  if (!profile) return null

  const tz       = resolveTimezone(profile.timezone)
  await closeOpenSessionsPastMidnight(profile.id)

  const today    = todayInTimezone(tz)
  const supabase = await createClient()

  const [{ data: openSession }, { data: todayLog }, { data: todayLeave }] = await Promise.all([
    supabase
      .from('time_logs')
      .select('*')
      .eq('employee_id', profile.id)
      .is('clock_out_at', null)
      .maybeSingle(),
    supabase
      .from('time_logs')
      .select('*')
      .eq('employee_id', profile.id)
      .eq('log_date', today)
      .maybeSingle(),
    supabase
      .from('leave_requests')
      .select('half_day, half_day_period')
      .eq('employee_id', profile.id)
      .eq('status', 'approved')
      .lte('start_date', today)
      .gte('end_date', today)
      .maybeSingle(),
  ])

  const session = openSession ?? todayLog ?? null
  const dayComplete = !!todayLog?.clock_out_at
  const canClockIn    = !todayLog
  const capAtIso = session && !session.clock_out_at && session.log_date
    ? autoClockOutAt(new Date(session.clock_in_at), session.log_date, tz).toISOString()
    : null

  const onLeave     = !!todayLeave && !todayLeave.half_day
  const halfDayLeave = todayLeave?.half_day ? todayLeave.half_day_period : null

  return (
    <ClockWidgetUI
      session={session}
      timeZone={tz}
      dayComplete={dayComplete}
      canClockIn={canClockIn}
      onLeave={onLeave}
      halfDayLeave={halfDayLeave}
      capAtIso={capAtIso}
    />
  )
}
