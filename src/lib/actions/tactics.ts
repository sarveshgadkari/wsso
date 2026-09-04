'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { getAllowedNext, STATUS_LABEL } from '@/lib/tactics-utils'
import { insertNotification } from '@/lib/actions/notifications'
import { requireOrgId } from '@/lib/saas/tenant'
import { assertAssigneesOnManagerTeam } from '@/lib/saas/team-scope'
import type { TacticStatus } from '@/lib/types'

const TacticInputSchema = z.object({
  title:           z.string().min(1, 'Title is required').max(200),
  description:     z.string().optional().nullable(),
  training_notes:  z.string().optional().nullable(),
  training_link:   z.string().trim().url('Enter a valid URL').optional().nullable().or(z.literal('')),
  project_id:      z.string().uuid().optional().nullable(),
  /** Primary assignee (first selected). Kept for legacy columns / filters. */
  assigned_to:     z.string().uuid('Select at least one employee'),
  /** All people on this work order (must include assigned_to). */
  assignee_ids:    z.array(z.string().uuid()).min(1, 'Select at least one employee'),
  priority:        z.enum(['low', 'medium', 'high', 'critical']),
  due_date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  estimated_hours: z.number().positive().max(9999).optional().nullable(),
}).superRefine((val, ctx) => {
  if (!val.assignee_ids.includes(val.assigned_to)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Primary assignee must be in the assignee list',
      path: ['assignee_ids'],
    })
  }
})

export type TacticInput = z.infer<typeof TacticInputSchema>

async function replaceTacticAssignees(tacticId: string, assigneeIds: string[], orgId: string) {
  const unique = Array.from(new Set(assigneeIds))
  const { error: delErr } = await supabaseAdmin
    .from('tactic_assignees')
    .delete()
    .eq('tactic_id', tacticId)
  if (delErr) throw new Error(delErr.message)

  const { error: insErr } = await supabaseAdmin
    .from('tactic_assignees')
    .insert(unique.map(profile_id => ({ tactic_id: tacticId, profile_id, organization_id: orgId })))
  if (insErr) throw new Error(insErr.message)
}

async function assertAssigneesInOrg(assigneeIds: string[], orgId: string) {
  const unique = Array.from(new Set(assigneeIds))
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, organization_id')
    .in('id', unique)
  if (error) throw new Error(error.message)
  if (!data || data.length !== unique.length || data.some((p) => p.organization_id !== orgId)) {
    throw new Error('Assignees must belong to this workspace')
  }
}

async function assertProjectInOrg(projectId: string | null | undefined, orgId: string) {
  if (!projectId) return
  const { data } = await supabaseAdmin
    .from('projects')
    .select('id, organization_id')
    .eq('id', projectId)
    .maybeSingle()
  if (!data || data.organization_id !== orgId) {
    throw new Error('Project is not in this workspace')
  }
}

export async function createTactic(raw: TacticInput) {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) throw new Error('Unauthorized')

  const input = TacticInputSchema.parse(raw)
  const orgId = requireOrgId(profile)
  await assertAssigneesInOrg(input.assignee_ids, orgId)
  await assertAssigneesOnManagerTeam(profile, input.assignee_ids)
  await assertProjectInOrg(input.project_id, orgId)
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
      organization_id: orgId,
      priority:        input.priority,
      due_date:        input.due_date         ?? null,
      estimated_hours: input.estimated_hours  ?? null,
      status:          'assigned',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  await replaceTacticAssignees(data.id, input.assignee_ids, orgId)

  await supabaseAdmin.from('activity_logs').insert({
    tactic_id:   data.id,
    employee_id: profile.id,
    action:      'Tactic created',
  })

  for (const assigneeId of Array.from(new Set(input.assignee_ids))) {
    if (assigneeId === profile.id) continue
    await insertNotification(
      assigneeId,
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
  const orgId = requireOrgId(profile)
  await assertAssigneesInOrg(input.assignee_ids, orgId)
  await assertAssigneesOnManagerTeam(profile, input.assignee_ids)
  await assertProjectInOrg(input.project_id, orgId)
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
    .eq('organization_id', orgId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  await replaceTacticAssignees(id, input.assignee_ids, orgId)

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
  const orgId = requireOrgId(profile)
  const supabase = await createClient()

  const { data: tactic, error: fetchErr } = await supabase
    .from('tactics')
    .select('id, title, status, assigned_to, created_by')
    .eq('id', tacticId)
    .eq('organization_id', orgId)
    .single()

  if (fetchErr || !tactic) throw new Error('Tactic not found or access denied')

  const { data: assigneeLinks } = await supabaseAdmin
    .from('tactic_assignees')
    .select('profile_id')
    .eq('tactic_id', tacticId)

  const assigneeIds = Array.from(
    new Set([
      tactic.assigned_to as string,
      ...((assigneeLinks ?? []) as { profile_id: string }[]).map(a => a.profile_id),
    ]),
  )

  const currentStatus = tactic.status as TacticStatus
  const ctx = {
    isCreator:  tactic.created_by === profile.id,
    isAssignee: assigneeIds.includes(profile.id),
  }
  const allowed = getAllowedNext(currentStatus, profile.role, ctx)

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
    .eq('organization_id', orgId)

  if (updateErr) throw new Error(updateErr.message)

  await supabaseAdmin.from('activity_logs').insert({
    tactic_id:   tacticId,
    employee_id: profile.id,
    action:      `Status changed to ${STATUS_LABEL[targetStatus]}`,
    notes:       comment?.trim() || null,
  })

  // Notify other assignees about status change
  for (const assigneeId of assigneeIds) {
    if (assigneeId === profile.id) continue
    await insertNotification(
      assigneeId,
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

  const orgId = requireOrgId(profile)
  const supabase = await createClient()
  const { data: tactic } = await supabase
    .from('tactics')
    .select('id')
    .eq('id', tacticId)
    .eq('organization_id', orgId)
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

  const orgId = requireOrgId(profile)
  const supabase = await createClient()
  const { data: tactic } = await supabase
    .from('tactics')
    .select('id, assigned_to, status')
    .eq('id', tacticId)
    .eq('organization_id', orgId)
    .single()

  if (!tactic) throw new Error('Work order not found or access denied')

  if (profile.role === 'employee') {
    const { data: link } = await supabaseAdmin
      .from('tactic_assignees')
      .select('profile_id')
      .eq('tactic_id', tacticId)
      .eq('profile_id', profile.id)
      .maybeSingle()

    const isAssignee = tactic.assigned_to === profile.id || !!link
    if (!isAssignee) {
      throw new Error('You can only update work orders assigned to you')
    }
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
  const orgId = requireOrgId(profile)
  const supabase = await createClient()

  const { data: tactic, error: fetchErr } = await supabase
    .from('tactics')
    .select('id, code, title, created_by')
    .eq('id', id)
    .eq('organization_id', orgId)
    .single()

  if (fetchErr || !tactic) throw new Error('Work order not found or access denied')

  if (profile.role !== 'admin' && tactic.created_by !== profile.id) {
    throw new Error('Only the creator or an admin can delete this work order')
  }

  const { data: docs } = await supabaseAdmin
    .from('documents')
    .select('id, file_path, source_type')
    .eq('tactic_code', tactic.code)
    .eq('organization_id', orgId)

  if (docs?.length) {
    const filePaths = docs
      .filter(d => d.source_type === 'file' && d.file_path)
      .map(d => d.file_path!)
    if (filePaths.length) {
      await supabaseAdmin.storage.from(DOCUMENTS_BUCKET).remove(filePaths)
    }
    await supabaseAdmin.from('documents').delete().eq('tactic_code', tactic.code).eq('organization_id', orgId)
  }

  const { error } = await supabase.from('tactics').delete().eq('id', id).eq('organization_id', orgId)
  if (error) throw new Error(error.message)

  revalidatePath('/tactics')
  revalidatePath('/kanban')
  revalidatePath('/documents')
  revalidatePath('/dashboard')
  revalidatePath('/my-work')
  return { id }
}
