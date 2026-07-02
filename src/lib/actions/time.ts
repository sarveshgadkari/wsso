'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireProfile } from '@/lib/auth/session'
import { endOfDayISO, todayInTimezone } from '@/lib/utils/dates'
import { resolveTimezone } from '@/lib/utils/timezones'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

type DbClient = SupabaseClient<Database>

// ── Helpers ────────────────────────────────────────────────────────────────────

async function employeeTimezone(employeeId: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('timezone')
    .eq('id', employeeId)
    .single()
  return resolveTimezone(data?.timezone)
}

async function closeStaleOpenSession(
  employeeId: string,
  tz: string,
  supabase: DbClient,
): Promise<void> {
  const today = todayInTimezone(tz)

  const { data: openSession } = await supabase
    .from('time_logs')
    .select('id, log_date')
    .eq('employee_id', employeeId)
    .is('clock_out_at', null)
    .maybeSingle()

  if (!openSession || openSession.log_date === today) return

  await supabaseAdmin
    .from('time_logs')
    .update({
      clock_out_at:  endOfDayISO(openSession.log_date, tz),
      closed_reason: 'auto_logout',
      auto_closed:   true,
    })
    .eq('id', openSession.id)
}

async function getTodayLog(employeeId: string, tz: string, supabase: DbClient) {
  const today = todayInTimezone(tz)
  return supabase
    .from('time_logs')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('log_date', today)
    .maybeSingle()
}

function revalidateTimePaths() {
  revalidatePath('/dashboard')
  revalidatePath('/time')
  revalidatePath('/time/team')
}

// ── Mechanism 2: close stale open sessions for a set of employees ─────────────

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

// ── Login clock-in (once per local day) ───────────────────────────────────────
// First app sign-in of the employee's local day creates today's time log.
// clock_in_at = login timestamp; employee still must clock out manually.

export async function recordLoginClockIn(): Promise<{ ok: boolean; error?: string }> {
  const profile  = await requireProfile()
  if (profile.role !== 'employee') return { ok: true }

  const tz       = resolveTimezone(profile.timezone)
  const supabase = await createClient()

  const { data: todayLog } = await getTodayLog(profile.id, tz, supabase)
  if (todayLog) return { ok: true }

  await closeStaleOpenSession(profile.id, tz, supabase)

  const { error } = await supabase
    .from('time_logs')
    .insert({
      employee_id:     profile.id,
      clock_in_source: 'login',
    })

  if (error) {
    // Unique index race — another request won
    if (error.code === '23505') return { ok: true }
    return { ok: false, error: error.message }
  }

  revalidateTimePaths()
  return { ok: true }
}

// ── Clock In (manual — once per local day) ──────────────────────────────────────

export async function clockIn() {
  const profile  = await requireProfile()
  if (profile.role !== 'employee') {
    return { error: 'Only employees can clock in here.' }
  }

  const tz       = resolveTimezone(profile.timezone)
  const supabase = await createClient()

  const { data: todayLog } = await getTodayLog(profile.id, tz, supabase)

  if (todayLog) {
    if (!todayLog.clock_out_at) {
      return { error: 'Already clocked in today — clock out when you finish.' }
    }
    return { error: 'You already have a time entry for today (one session per day in your timezone).' }
  }

  await closeStaleOpenSession(profile.id, tz, supabase)

  const { data, error } = await supabase
    .from('time_logs')
    .insert({
      employee_id:     profile.id,
      clock_in_source: 'manual',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return { error: 'You already have a time entry for today (one session per day in your timezone).' }
    }
    return { error: error.message }
  }

  revalidateTimePaths()
  return { data }
}

// ── Clock Out ─────────────────────────────────────────────────────────────────

export async function clockOut() {
  const profile  = await requireProfile()
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

  revalidateTimePaths()
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
