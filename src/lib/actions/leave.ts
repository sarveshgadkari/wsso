'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireProfile } from '@/lib/auth/session'

function revalidateLeavePaths() {
  revalidatePath('/leave')
  revalidatePath('/leave/team')
  revalidatePath('/dashboard')
}

const requestSchema = z
  .object({
    start_date:      z.string().min(1),
    end_date:        z.string().min(1),
    half_day:        z.boolean(),
    half_day_period: z.enum(['morning', 'afternoon']).optional().nullable(),
    reason:          z.string().min(1, 'Reason is required'),
  })
  .refine(d => d.end_date >= d.start_date, {
    message: 'End date must be on or after the start date',
    path:    ['end_date'],
  })
  .refine(d => !d.half_day || (d.start_date === d.end_date && !!d.half_day_period), {
    message: 'A half-day request must be a single day with morning/afternoon selected',
    path:    ['half_day_period'],
  })

export async function requestLeave(input: z.infer<typeof requestSchema>) {
  const profile = await requireProfile()

  const parsed = requestSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('leave_requests')
    .insert({
      employee_id:     profile.id,
      start_date:      parsed.data.start_date,
      end_date:        parsed.data.end_date,
      half_day:        parsed.data.half_day,
      half_day_period: parsed.data.half_day ? parsed.data.half_day_period : null,
      reason:          parsed.data.reason,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidateLeavePaths()
  return { data }
}

export async function cancelLeaveRequest(id: string) {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { error } = await supabase
    .from('leave_requests')
    .delete()
    .eq('id', id)
    .eq('employee_id', profile.id)
    .eq('status', 'pending')

  if (error) return { error: error.message }

  revalidateLeavePaths()
  return { data: true }
}

export async function reviewLeaveRequest(
  id:          string,
  decision:    'approved' | 'rejected',
  reviewNote?: string,
) {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) return { error: 'Access denied.' }

  // RLS (lr_manager_select / lr_admin_all) scopes this to what the reviewer may see —
  // a manager who can't SELECT the row can't approve it either.
  const supabase = await createClient()
  const { data: request } = await supabase
    .from('leave_requests')
    .select('id, employee_id, status')
    .eq('id', id)
    .single()

  if (!request) return { error: 'Leave request not found or not visible to you.' }
  if (request.status !== 'pending') return { error: 'This request has already been reviewed.' }

  const { data, error } = await supabaseAdmin
    .from('leave_requests')
    .update({
      status:      decision,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote?.trim() || null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return { error: error.message }

  await supabaseAdmin.from('activity_logs').insert({
    tactic_id:   null,
    employee_id: request.employee_id,
    action:      `leave_request.${decision}`,
    meta: {
      reviewed_by:      profile.id,
      reviewed_by_name: profile.full_name,
      leave_request_id: id,
    },
  })

  revalidateLeavePaths()
  return { data }
}
