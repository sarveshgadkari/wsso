'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getAllowedNext, STATUS_LABEL } from '@/lib/tactics-utils'
import { insertNotification } from '@/lib/actions/notifications'
import type { TacticStatus } from '@/lib/types'

const TacticInputSchema = z.object({
  title:           z.string().min(1, 'Title is required').max(200),
  description:     z.string().optional().nullable(),
  training_notes:  z.string().optional().nullable(),
  training_link:   z.string().trim().url('Enter a valid URL').optional().nullable().or(z.literal('')),
  project_id:      z.string().uuid().optional().nullable(),
  assigned_to:     z.string().uuid('Select an employee'),
  priority:        z.enum(['low', 'medium', 'high', 'critical']),
  due_date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  estimated_hours: z.number().positive().max(9999).optional().nullable(),
})

export type TacticInput = z.infer<typeof TacticInputSchema>

export async function createTactic(raw: TacticInput) {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) throw new Error('Unauthorized')

  const input = TacticInputSchema.parse(raw)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tactics')
    .insert({
      title:           input.title,
      description:     input.description     ?? null,
      training_notes:  input.training_notes   ?? null,
      training_link:   input.training_link    || null,
      project_id:      input.project_id      ?? null,
      assigned_to:     input.assigned_to,
      created_by:      profile.id,
      priority:        input.priority,
      due_date:        input.due_date         ?? null,
      estimated_hours: input.estimated_hours  ?? null,
      status:          'assigned',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  await supabaseAdmin.from('activity_logs').insert({
    tactic_id:   data.id,
    employee_id: profile.id,
    action:      'Tactic created',
  })

  // Notify the assigned employee (skip self-assignment)
  if (input.assigned_to !== profile.id) {
    await insertNotification(
      input.assigned_to,
      'tactic_assigned',
      `You've been assigned a new task: "${input.title}"`,
      `/tactics/${data.id}`,
    )
  }

  revalidatePath('/tactics')
  revalidatePath('/kanban')
  return data
}

export async function updateTactic(id: string, raw: TacticInput) {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) throw new Error('Unauthorized')

  const input = TacticInputSchema.parse(raw)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('tactics')
    .update({
      title:           input.title,
      description:     input.description     ?? null,
      training_notes:  input.training_notes   ?? null,
      training_link:   input.training_link    || null,
      project_id:      input.project_id      ?? null,
      assigned_to:     input.assigned_to,
      priority:        input.priority,
      due_date:        input.due_date         ?? null,
      estimated_hours: input.estimated_hours  ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)

  await supabaseAdmin.from('activity_logs').insert({
    tactic_id:   id,
    employee_id: profile.id,
    action:      'Tactic updated',
  })

  revalidatePath('/tactics')
  revalidatePath(`/tactics/${id}`)
  revalidatePath('/kanban')
  return data
}

export async function transitionStatus(
  tacticId: string,
  targetStatus: TacticStatus,
  comment?: string,
  workNotes?: string,
) {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data: tactic, error: fetchErr } = await supabase
    .from('tactics')
    .select('id, title, status, assigned_to, created_by')
    .eq('id', tacticId)
    .single()

  if (fetchErr || !tactic) throw new Error('Tactic not found or access denied')

  const currentStatus = tactic.status as TacticStatus
  const allowed = getAllowedNext(currentStatus, profile.role)

  if (!allowed.includes(targetStatus)) {
    throw new Error(
      `Cannot transition from "${STATUS_LABEL[currentStatus]}" to "${STATUS_LABEL[targetStatus]}"`,
    )
  }

  if (currentStatus === 'review' && targetStatus === 'in_progress' && !comment?.trim()) {
    throw new Error('A reason is required when sending a tactic back to In Progress')
  }

  // Save pending work notes when employee submits for review
  const trimmedWorkNotes = workNotes?.trim()
  if (targetStatus === 'review' && trimmedWorkNotes) {
    await supabaseAdmin.from('activity_logs').insert({
      tactic_id:    tacticId,
      employee_id:  profile.id,
      action:       'Work update',
      notes:        trimmedWorkNotes,
    })
  }

  const { error: updateErr } = await supabase
    .from('tactics')
    .update({ status: targetStatus })
    .eq('id', tacticId)

  if (updateErr) throw new Error(updateErr.message)

  await supabaseAdmin.from('activity_logs').insert({
    tactic_id:   tacticId,
    employee_id: profile.id,
    action:      `Status changed to ${STATUS_LABEL[targetStatus]}`,
    notes:       comment?.trim() || null,
  })

  // Notify assigned employee about any status change (skip if they did it themselves)
  if (tactic.assigned_to !== profile.id) {
    await insertNotification(
      tactic.assigned_to,
      'tactic_status',
      `"${tactic.title}" moved to ${STATUS_LABEL[targetStatus]}`,
      `/tactics/${tacticId}`,
    )
  }

  // When submitted for review, notify the creator (manager/admin) as well
  if (targetStatus === 'review' && tactic.created_by !== profile.id) {
    await insertNotification(
      tactic.created_by,
      'tactic_review',
      `"${tactic.title}" is ready for your review`,
      `/tactics/${tacticId}`,
    )
  }

  revalidatePath('/tactics')
  revalidatePath(`/tactics/${tacticId}`)
  revalidatePath('/kanban')
  revalidatePath('/dashboard')
  return { status: targetStatus }
}

export async function logHours(
  tacticId: string,
  { hours, notes }: { hours: number; notes?: string },
) {
  const profile = await requireProfile()
  if (hours <= 0 || hours > 24) throw new Error('Hours must be between 0.1 and 24')

  const supabase = await createClient()
  const { data: tactic } = await supabase
    .from('tactics')
    .select('id')
    .eq('id', tacticId)
    .single()

  if (!tactic) throw new Error('Tactic not found or access denied')

  await supabaseAdmin.from('activity_logs').insert({
    tactic_id:    tacticId,
    employee_id:  profile.id,
    action:       `Logged ${hours}h`,
    hours_logged: hours,
    notes:        notes?.trim() || null,
  })

  revalidatePath(`/tactics/${tacticId}`)
}

/** Employee adds a work progress note without logging hours */
export async function submitWorkUpdate(tacticId: string, notes: string) {
  const profile = await requireProfile()
  const trimmed = notes.trim()
  if (!trimmed) throw new Error('Please describe what you worked on')

  const supabase = await createClient()
  const { data: tactic } = await supabase
    .from('tactics')
    .select('id, assigned_to, status')
    .eq('id', tacticId)
    .single()

  if (!tactic) throw new Error('Work order not found or access denied')

  if (profile.role === 'employee' && tactic.assigned_to !== profile.id) {
    throw new Error('You can only update work orders assigned to you')
  }

  if (['done', 'archived'].includes(tactic.status)) {
    throw new Error('This work order is already completed')
  }

  await supabaseAdmin.from('activity_logs').insert({
    tactic_id:    tacticId,
    employee_id:  profile.id,
    action:       'Work update',
    hours_logged: null,
    notes:        trimmed,
  })

  revalidatePath(`/tactics/${tacticId}`)
  revalidatePath('/activity-log')
  revalidatePath('/dashboard')
}

const DOCUMENTS_BUCKET = 'documents'

export async function deleteTactic(id: string) {
  const profile = await requireProfile()
  const supabase = await createClient()

  const { data: tactic, error: fetchErr } = await supabase
    .from('tactics')
    .select('id, code, title, created_by')
    .eq('id', id)
    .single()

  if (fetchErr || !tactic) throw new Error('Work order not found or access denied')

  if (profile.role !== 'admin' && tactic.created_by !== profile.id) {
    throw new Error('Only the creator or an admin can delete this work order')
  }

  const { data: docs } = await supabaseAdmin
    .from('documents')
    .select('id, file_path, source_type')
    .eq('tactic_code', tactic.code)

  if (docs?.length) {
    const filePaths = docs
      .filter(d => d.source_type === 'file' && d.file_path)
      .map(d => d.file_path!)
    if (filePaths.length) {
      await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).remove(filePaths)
    }
    await supabaseAdmin.from('documents').delete().eq('tactic_code', tactic.code)
  }

  const { error } = await supabase.from('tactics').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/tactics')
  revalidatePath('/kanban')
  revalidatePath('/documents')
  revalidatePath('/dashboard')
  revalidatePath('/my-work')
  return { id }
}
