'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireProfile } from '@/lib/auth/session'

export async function clockIn() {
  const profile = await requireProfile()
  const supabase = await createClient()

  // Server-side guard — the partial unique index also enforces this at the DB level
  const { data: existing } = await supabase
    .from('time_logs')
    .select('id')
    .eq('employee_id', profile.id)
    .is('clock_out_at', null)
    .maybeSingle()

  if (existing) return { error: 'Already clocked in — clock out first.' }

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

  // _trg_calc_duration fires on UPDATE and fills duration_minutes from timestamps
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

  // DB trigger recomputes duration_minutes from the corrected timestamps
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
