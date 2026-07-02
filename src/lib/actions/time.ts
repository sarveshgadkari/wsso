'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireProfile } from '@/lib/auth/session'
import { endOfDayISO, todayInTimezone } from '@/lib/utils/dates'
import { resolveTimezone } from '@/lib/utils/timezones'

// ── Helpers ────────────────────────────────────────────────────────────────────

async function employeeTimezone(employeeId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('timezone')
    .eq('id', employeeId)
    .single()
  return resolveTimezone(data?.timezone)
}

// ── Mechanism 2: close stale open sessions for a set of employees ─────────────
// Called from server-component page data-fetching before rendering.
// Closes any session with clock_out_at IS NULL and clock_in_at > 16 h ago.
// Returns the number of sessions that were closed.

export async function closeStaleSessionsForEmployees(
  employeeIds: string[],
): Promise<number> {
  if (!employeeIds.length) return 0

  const cutoff = new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString()

  const { data: stale } = await supabaseAdmin
    .from('time_logs')
    .select('id, log_date, employee_id')
    .in('employee_id', employeeIds)
    .is('clock_out_at', null)
    .lt('clock_in_at', cutoff)

  if (!stale?.length) return 0

  await Promise.all(
    stale.map(async (s) => {
      const row = s as { id: string; log_date: string; employee_id: string }
      const tz  = await employeeTimezone(row.employee_id)
      return supabaseAdmin
        .from('time_logs')
        .update({
          clock_out_at:  endOfDayISO(row.log_date, tz),
          closed_reason: 'auto_logout',
          auto_closed:   true,
        })
        .eq('id', row.id)
    }),
  )

  return stale.length
}

// ── Clock In ──────────────────────────────────────────────────────────────────
// Mechanism 1: before creating a new session, auto-close any open session from
// a PREVIOUS day (stale).  If an open session exists from TODAY, block the
// clock-in (user must clock out manually).

export async function clockIn() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const tz    = resolveTimezone(profile.timezone)
  const today = todayInTimezone(tz)

  const { data: existingSession } = await supabase
    .from('time_logs')
    .select('id, log_date')
    .eq('employee_id', profile.id)
    .is('clock_out_at', null)
    .maybeSingle()

  if (existingSession) {
    if (existingSession.log_date === today) {
      return { error: 'Already clocked in — clock out first.' }
    }
    // Previous-day stale session — auto-close at 11:59 PM of that day (employee TZ)
    await supabaseAdmin
      .from('time_logs')
      .update({
        clock_out_at:  endOfDayISO(existingSession.log_date, tz),
        closed_reason: 'auto_logout',
        auto_closed:   true,
      })
      .eq('id', existingSession.id)
  }

  const { data, error } = await supabase
    .from('time_logs')
    .insert({ employee_id: profile.id })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/time')
  return { data }
}

// ── Clock Out ─────────────────────────────────────────────────────────────────

export async function clockOut() {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data: session } = await supabase
    .from('time_logs')
    .select('id')
    .eq('employee_id', profile.id)
    .is('clock_out_at', null)
    .maybeSingle()

  if (!session) return { error: 'No open clock-in session found.' }

  const { data, error } = await supabase
    .from('time_logs')
    .update({ clock_out_at: new Date().toISOString(), closed_reason: 'manual' })
    .eq('id', session.id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/time')
  revalidatePath('/time/team')
  return { data }
}

// ── Admin: correct a completed time log ───────────────────────────────────────

const correctionSchema = z.object({
  clock_in_at:  z.string().min(1),
  clock_out_at: z.string().min(1),
})

export async function adminCorrectTimeLog(
  id: string,
  input: z.infer<typeof correctionSchema>,
) {
  const profile = await requireProfile()
  if (profile.role !== 'admin') return { error: 'Admin access required.' }

  const parsed = correctionSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid datetime values' }

  const clockIn  = new Date(parsed.data.clock_in_at)
  const clockOut = new Date(parsed.data.clock_out_at)

  if (isNaN(clockIn.getTime()) || isNaN(clockOut.getTime())) {
    return { error: 'Invalid date format.' }
  }
  if (clockOut <= clockIn) {
    return { error: 'Clock-out must be after clock-in.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('time_logs')
    .update({
      clock_in_at:   clockIn.toISOString(),
      clock_out_at:  clockOut.toISOString(),
      closed_reason: 'admin_correction',
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/time')
  revalidatePath('/time/team')
  return { data }
}

// ── Mechanism 3: Force Clock Out (Admin / Manager) ────────────────────────────
// Closes an open session with a provided clock-out time.
// Session is tagged auto_closed = true + reason = admin_correction.
// Action is audited to activity_logs (tactic_id nullable after migration).

export async function forceClockOut(
  timeLogId:   string,
  clockOutAt:  string,
  employeeId:  string,
) {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) {
    return { error: 'Access denied.' }
  }

  const clockOut = new Date(clockOutAt)
  if (isNaN(clockOut.getTime())) return { error: 'Invalid datetime.' }

  // Verify the viewer can see this session (RLS enforces team scope for managers)
  const supabase = await createClient()
  const { data: session } = await supabase
    .from('time_logs')
    .select('id, clock_in_at')
    .eq('id', timeLogId)
    .eq('employee_id', employeeId)
    .is('clock_out_at', null)
    .single()

  if (!session) return { error: 'Session not found or already closed.' }

  const clockIn = new Date(session.clock_in_at)
  if (clockOut <= clockIn) return { error: 'Clock-out must be after clock-in.' }

  const { data, error } = await supabaseAdmin
    .from('time_logs')
    .update({
      clock_out_at:  clockOut.toISOString(),
      closed_reason: 'admin_correction',
      auto_closed:   true,
    })
    .eq('id', timeLogId)
    .select()
    .single()

  if (error) return { error: error.message }

  // Audit trail — tactic_id is now nullable
  await supabaseAdmin.from('activity_logs').insert({
    tactic_id:   null,
    employee_id: employeeId,
    action:      'time_log.force_closed',
    meta: {
      closed_by:      profile.id,
      closed_by_name: profile.full_name,
      time_log_id:    timeLogId,
      clock_out_at:   clockOut.toISOString(),
    },
  })

  revalidatePath('/time/team')
  revalidatePath(`/time/team/${employeeId}`)
  revalidatePath(`/employees/${employeeId}`)
  return { data }
}
