'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireProfile } from '@/lib/auth/session'
import { todayInTimezone, autoClockOutAt, MAX_WORK_MINUTES } from '@/lib/utils/dates'
import { closeOpenSessionsPastMidnight } from '@/lib/time/auto-close'
import { resolveTimezone } from '@/lib/utils/timezones'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'
import { mergeWorkspaceSettings } from '@/lib/workspace/settings'

type DbClient = SupabaseClient<Database>

// ── Helpers ────────────────────────────────────────────────────────────────────

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
  revalidatePath('/approvals')
}

async function workspaceTimeRules(orgId: string | null) {
  if (!orgId) return mergeWorkspaceSettings({}).time
  const { data } = await supabaseAdmin.from('organizations').select('settings').eq('id', orgId).maybeSingle()
  return mergeWorkspaceSettings(data?.settings).time
}

function cappedClockOut(clockInAt: string, logDate: string, tz: string, requested = new Date()): Date {
  const cap = autoClockOutAt(new Date(clockInAt), logDate, tz)
  const out = requested.getTime() > cap.getTime() ? cap : requested
  const start = new Date(clockInAt)
  if (out.getTime() <= start.getTime()) return new Date(start.getTime() + 1000)
  return out
}

export async function closeStaleSessionsForEmployees(employeeIds: string[]): Promise<number> {
  if (!employeeIds.length) return 0
  let closed = 0
  for (const id of employeeIds) {
    closed += await closeOpenSessionsPastMidnight(id)
  }
  return closed
}

// ── Clock In (manual — once per local day) ──────────────────────────────────────

export async function clockIn(note?: string) {
  const profile  = await requireProfile()

  const tz       = resolveTimezone(profile.timezone)
  const supabase = await createClient()

  const { data: todayLog } = await getTodayLog(profile.id, tz, supabase)

  if (todayLog) {
    if (!todayLog.clock_out_at) {
      return { error: 'Already clocked in today — clock out when you finish.' }
    }
    return { error: 'You already have a time entry for today (one session per day in your timezone).' }
  }

  await closeOpenSessionsPastMidnight(profile.id)

  const trimmedNote = note?.trim() || null
  const rules = await workspaceTimeRules(profile.organization_id)
  if (rules.requireClockInNote && !trimmedNote) {
    return { error: 'A clock-in note is required by your workspace.' }
  }

  const { data, error } = await supabase
    .from('time_logs')
    .insert({
      employee_id:          profile.id,
      clock_in_source:      'manual',
      clock_in_note:        trimmedNote,
      clock_in_note_status: trimmedNote ? 'pending' : null,
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

export async function clockOut(note?: string) {
  const profile  = await requireProfile()
  const tz       = resolveTimezone(profile.timezone)
  const supabase = await createClient()

  await closeOpenSessionsPastMidnight(profile.id)

  const { data: session } = await supabase
    .from('time_logs')
    .select('id, clock_in_at, log_date')
    .eq('employee_id', profile.id)
    .is('clock_out_at', null)
    .maybeSingle()

  if (!session) return { error: 'No open clock-in session found.' }

  const trimmedNote = note?.trim() || null
  const rules = await workspaceTimeRules(profile.organization_id)
  if (rules.requireClockOutNote && !trimmedNote) {
    return { error: 'A clock-out note is required by your workspace.' }
  }
  const clockOutAt = cappedClockOut(session.clock_in_at, session.log_date, tz)

  const { data, error } = await supabase
    .from('time_logs')
    .update({
      clock_out_at:          clockOutAt.toISOString(),
      closed_reason:         'manual',
      clock_out_note:        trimmedNote,
      clock_out_note_status: trimmedNote ? 'pending' : null,
    })
    .eq('id', session.id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidateTimePaths()
  return { data }
}

// ── Manager / Admin: approve or reject a clock-in/out note ───────────────────

export async function reviewClockNote(
  timeLogId: string,
  field:     'clock_in' | 'clock_out',
  decision:  'approved' | 'rejected',
) {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) return { error: 'Access denied.' }

  const supabase = await createClient()
  const { data: log } = await supabase
    .from('time_logs')
    .select('id, employee_id')
    .eq('id', timeLogId)
    .single()

  if (!log) return { error: 'Time log not found or not visible to you.' }

  const update = field === 'clock_in'
    ? { clock_in_note_status: decision }
    : { clock_out_note_status: decision }

  const { data, error } = await supabaseAdmin
    .from('time_logs')
    .update(update)
    .eq('id', timeLogId)
    .select()
    .single()

  if (error) return { error: error.message }

  await supabaseAdmin.from('activity_logs').insert({
    tactic_id:   null,
    employee_id: log.employee_id,
    action:      `time_log.${field}_note_${decision}`,
    meta: {
      reviewed_by:      profile.id,
      reviewed_by_name: profile.full_name,
      time_log_id:      timeLogId,
    },
  })

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
  if (clockOut.getTime() - clockIn.getTime() > MAX_WORK_MINUTES * 60_000) {
    return { error: 'A shift cannot be longer than 24 hours.' }
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
  if (clockOut.getTime() - clockIn.getTime() > MAX_WORK_MINUTES * 60_000) {
    return { error: 'A shift cannot be longer than 24 hours.' }
  }

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
