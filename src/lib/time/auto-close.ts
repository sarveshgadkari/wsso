import { supabaseAdmin } from '@/lib/supabase/admin'
import { autoClockOutAt, isPastAutoClockOut } from '@/lib/utils/dates'
import { resolveTimezone } from '@/lib/utils/timezones'

type OpenSession = {
  id: string
  clock_in_at: string
  log_date: string
  employee_id: string
}

async function timezonesFor(employeeIds: string[]): Promise<Record<string, string>> {
  if (!employeeIds.length) return {}
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, timezone')
    .in('id', employeeIds)
  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    map[row.id] = resolveTimezone(row.timezone)
  }
  return map
}

export async function closeOpenSessionsPastMidnight(employeeId?: string): Promise<number> {
  let query = supabaseAdmin
    .from('time_logs')
    .select('id, clock_in_at, log_date, employee_id')
    .is('clock_out_at', null)

  if (employeeId) query = query.eq('employee_id', employeeId)

  const { data: open, error } = await query
  if (error || !open?.length) return 0

  const sessions = open as OpenSession[]
  const tzMap = await timezonesFor(Array.from(new Set(sessions.map((s) => s.employee_id))))
  const now = new Date()
  let closed = 0

  for (const session of sessions) {
    const tz = tzMap[session.employee_id] ?? resolveTimezone(null)
    const clockIn = new Date(session.clock_in_at)
    if (!session.log_date || !isPastAutoClockOut(clockIn, session.log_date, tz, now)) continue

    const clockOut = autoClockOutAt(clockIn, session.log_date, tz)
    const { error: updateErr } = await supabaseAdmin
      .from('time_logs')
      .update({
        clock_out_at: clockOut.toISOString(),
        closed_reason: 'auto_logout',
        auto_closed: true,
      })
      .eq('id', session.id)
      .is('clock_out_at', null)

    if (!updateErr) closed++
  }

  return closed
}
