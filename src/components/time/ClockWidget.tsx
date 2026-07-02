import { getProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { todayInTimezone } from '@/lib/utils/dates'
import { resolveTimezone } from '@/lib/utils/timezones'
import { ClockWidgetUI } from './ClockWidgetUI'

export async function ClockWidget() {
  const profile = await getProfile()
  if (!profile) return null

  const tz       = resolveTimezone(profile.timezone)
  const today    = todayInTimezone(tz)
  const supabase = await createClient()

  const [{ data: openSession }, { data: todayLog }] = await Promise.all([
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
  ])

  const session = openSession ?? todayLog ?? null
  const dayComplete = !!todayLog?.clock_out_at
  const canClockIn    = !todayLog

  return (
    <ClockWidgetUI
      session={session}
      timeZone={tz}
      dayComplete={dayComplete}
      canClockIn={canClockIn}
    />
  )
}
