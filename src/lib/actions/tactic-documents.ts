'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { requireProfile } from '@/lib/auth/session'
import type { Profile } from '@/lib/types'

// ── Input shapes ──────────────────────────────────────────────────────────────

export interface TaskInput {
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  assigned_to: string | null   // profile UUID or null
  owner_name: string | null    // free-text for external owner
  target_date: string | null   // ISO date or null
  order_no: number
}

export interface NextStepInput {
  description: string
  owner: string | null         // profile UUID or null
  owner_name: string | null    // free-text for external owner
  due_date: string | null      // ISO date or null
  order_no: number
}

export interface TacticDocumentInput {
  date_of_meeting: string
  time_of_meeting: string
  facilitator: string
  location: string
  attendees: string
  purpose: string
  background_info: string
  takeaways: string
  company_id: string
  project_id: string
  tactic_id: string
  tasks: TaskInput[]
  next_steps: NextStepInput[]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function nullIfEmpty(s: string): string | null {
  return s.trim() || null
}

async function insertTasksAndSteps(
  docId: string,
  tasks: TaskInput[],
  nextSteps: NextStepInput[],
) {
  const supabase = await createClient()

  if (tasks.length > 0) {
    const { error } = await supabase.from('tactic_tasks').insert(
      tasks.map(t => ({
        tactic_document_id: docId,
        title:       t.title,
        description: t.description || '',
        status:      t.status,
        assigned_to: t.assigned_to || null,
        owner_name:  t.owner_name  || null,
        target_date: t.target_date || null,
        order_no:    t.order_no,
      })),
    )
    if (error) throw new Error(error.message)
  }

  if (nextSteps.length > 0) {
    const { error } = await supabase.from('tactic_next_steps').insert(
      nextSteps.map(ns => ({
        tactic_document_id: docId,
        description: ns.description,
        owner:       ns.owner      || null,
        owner_name:  ns.owner_name || null,
        due_date:    ns.due_date   || null,
        order_no:    ns.order_no,
      })),
    )
    if (error) throw new Error(error.message)
  }
}

async function notifyReviewer(
  creator: Profile,
  docId: string,
  docCode: string,
) {
  if (creator.role === 'employee') {
    if (!creator.manager_id) return
    await supabaseAdmin.from('notifications').insert({
      user_id: creator.manager_id,
      type:    'tactic_review_requested',
      message: `${creator.full_name} submitted a TACTIC for your review: ${docCode}`,
      link:    `/tactic-documents/${docId}`,
    })
  } else if (creator.role === 'manager') {
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('status', 'active')
    if (!admins?.length) return
    await supabaseAdmin.from('notifications').insert(
      admins.map((a: { id: string }) => ({
        user_id: a.id,
        type:    'tactic_review_requested',
        message: `${creator.full_name} submitted a TACTIC for your review: ${docCode}`,
        link:    `/tactic-documents/${docId}`,
      })),
    )
  }
  // Admin: no review needed — notification not sent
}

// ── Public server actions ─────────────────────────────────────────────────────

export async function createTacticDocument(
  input: TacticDocumentInput,
  submitForReview: boolean,
) {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const now    = new Date().toISOString()
  const status = submitForReview && profile.role !== 'admin'
    ? 'submitted'
    : profile.role === 'admin' ? 'approved' : 'draft'

  const { data: doc, error } = await supabase
    .from('tactic_documents')
    .insert({
      purpose:         input.purpose,
      date_of_meeting: nullIfEmpty(input.date_of_meeting),
      time_of_meeting: nullIfEmpty(input.time_of_meeting),
      facilitator:     nullIfEmpty(input.facilitator),
      location:        nullIfEmpty(input.location),
      attendees:       nullIfEmpty(input.attendees),
      background_info: nullIfEmpty(input.background_info),
      takeaways:       nullIfEmpty(input.takeaways),
      company_id:      nullIfEmpty(input.company_id),
      project_id:      nullIfEmpty(input.project_id),
      tactic_id:       nullIfEmpty(input.tactic_id),
      created_by:      profile.id,
      status,
      submitted_at:    status === 'submitted' ? now : null,
    })
    .select()
    .single()

  if (error || !doc) throw new Error(error?.message ?? 'Failed to create document')

  await insertTasksAndSteps(doc.id, input.tasks, input.next_steps)

  // Log activity
  await supabase.from('activity_logs').insert({
    employee_id: profile.id,
    action: status === 'submitted' ? 'tactic_doc.submitted' : 'tactic_doc.created',
    meta: { entity_type: 'tactic_document', entity_id: doc.id, entity_code: doc.code },
  })

  // Send notification to reviewer
  if (status === 'submitted') {
    await notifyReviewer(profile, doc.id, doc.code)
  }

  revalidatePath('/tactic-documents')
  return doc
}

export async function updateTacticDocument(
  id: string,
  input: TacticDocumentInput,
  resubmit: boolean,
) {
  const profile  = await requireProfile()
  const supabase = await createClient()

  // Verify the caller owns this document
  const { data: existing } = await supabase
    .from('tactic_documents')
    .select('id, code, status, created_by')
    .eq('id', id)
    .single()

  if (!existing) throw new Error('Document not found')
  if (existing.created_by !== profile.id && profile.role !== 'admin')
    throw new Error('Not authorized')
  if (!['draft', 'revision_needed'].includes(existing.status))
    throw new Error('Document cannot be edited in its current status')

  const now    = new Date().toISOString()
  const status = resubmit
    ? (profile.role === 'admin' ? 'approved' : 'submitted')
    : 'draft'

  const { error } = await supabase
    .from('tactic_documents')
    .update({
      purpose:         input.purpose,
      date_of_meeting: nullIfEmpty(input.date_of_meeting),
      time_of_meeting: nullIfEmpty(input.time_of_meeting),
      facilitator:     nullIfEmpty(input.facilitator),
      location:        nullIfEmpty(input.location),
      attendees:       nullIfEmpty(input.attendees),
      background_info: nullIfEmpty(input.background_info),
      takeaways:       nullIfEmpty(input.takeaways),
      company_id:      nullIfEmpty(input.company_id),
      project_id:      nullIfEmpty(input.project_id),
      tactic_id:       nullIfEmpty(input.tactic_id),
      status,
      review_note:     null,
      submitted_at:    status === 'submitted' ? now : null,
      reviewed_at:     null,
      reviewer_id:     null,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  // Replace tasks and next steps
  await supabase.from('tactic_tasks').delete().eq('tactic_document_id', id)
  await supabase.from('tactic_next_steps').delete().eq('tactic_document_id', id)
  await insertTasksAndSteps(id, input.tasks, input.next_steps)

  const action = resubmit ? 'tactic_doc.resubmitted' : 'tactic_doc.updated'
  await supabase.from('activity_logs').insert({
    employee_id: profile.id,
    action,
    meta: {
      entity_type: 'tactic_document',
      entity_id:   id,
      entity_code: existing.code,
    },
  })

  if (status === 'submitted') {
    await notifyReviewer(profile, id, existing.code)
  }

  revalidatePath('/tactic-documents')
  revalidatePath(`/tactic-documents/${id}`)
  return { id, code: existing.code }
}

export async function submitTacticDocument(id: string) {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('tactic_documents')
    .select('id, code, status, created_by')
    .eq('id', id)
    .single()

  if (!doc) throw new Error('Document not found')
  if (doc.created_by !== profile.id) throw new Error('Not authorized')
  if (doc.status !== 'draft') throw new Error('Document is not in draft status')

  const { error } = await supabase
    .from('tactic_documents')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw new Error(error.message)

  await supabase.from('activity_logs').insert({
    employee_id: profile.id,
    action: 'tactic_doc.submitted',
    meta: { entity_type: 'tactic_document', entity_id: id, entity_code: doc.code },
  })

  await notifyReviewer(profile, id, doc.code)

  revalidatePath('/tactic-documents')
  revalidatePath(`/tactic-documents/${id}`)
}

export async function approveTacticDocument(id: string) {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role))
    throw new Error('Only admin or manager can approve')

  // Use admin client to read and update across ownership boundaries
  const { data: doc } = await supabaseAdmin
    .from('tactic_documents')
    .select(`
      id, code, status, created_by,
      creator:profiles!tactic_documents_created_by_fkey(id, role, manager_id, full_name)
    `)
    .eq('id', id)
    .single()

  if (!doc) throw new Error('Document not found')
  if (doc.status !== 'submitted') throw new Error('Document is not pending review')

  const creator = doc.creator as {
    id: string; role: string; manager_id: string | null; full_name: string
  }

  // Authorization: manager can only approve their direct reports' documents
  if (profile.role === 'manager') {
    if (creator.role !== 'employee' || creator.manager_id !== profile.id)
      throw new Error('You are not the reviewer for this document')
  }

  const { error } = await supabaseAdmin
    .from('tactic_documents')
    .update({
      status:      'approved',
      reviewer_id: profile.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  await supabaseAdmin.from('activity_logs').insert({
    employee_id: profile.id,
    action: 'tactic_doc.approved',
    meta: { entity_type: 'tactic_document', entity_id: id, entity_code: doc.code },
  })

  await supabaseAdmin.from('notifications').insert({
    user_id: doc.created_by,
    type:    'tactic_doc_approved',
    message: `Your TACTIC ${doc.code} has been approved.`,
    link:    `/tactic-documents/${id}`,
  })

  revalidatePath('/tactic-documents')
  revalidatePath(`/tactic-documents/${id}`)
}

export async function requestRevision(id: string, note: string) {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role))
    throw new Error('Only admin or manager can request revision')

  const { data: doc } = await supabaseAdmin
    .from('tactic_documents')
    .select(`
      id, code, status, created_by,
      creator:profiles!tactic_documents_created_by_fkey(id, role, manager_id)
    `)
    .eq('id', id)
    .single()

  if (!doc) throw new Error('Document not found')
  if (doc.status !== 'submitted') throw new Error('Document is not pending review')

  const creator = doc.creator as { id: string; role: string; manager_id: string | null }

  if (profile.role === 'manager') {
    if (creator.role !== 'employee' || creator.manager_id !== profile.id)
      throw new Error('You are not the reviewer for this document')
  }

  const { error } = await supabaseAdmin
    .from('tactic_documents')
    .update({
      status:      'revision_needed',
      reviewer_id: profile.id,
      review_note: note.trim(),
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  await supabaseAdmin.from('activity_logs').insert({
    employee_id: profile.id,
    action: 'tactic_doc.revision_requested',
    meta: {
      entity_type: 'tactic_document',
      entity_id:   id,
      entity_code: doc.code,
      note:        note.trim(),
    },
  })

  await supabaseAdmin.from('notifications').insert({
    user_id: doc.created_by,
    type:    'tactic_doc_revision',
    message: `Revision requested on ${doc.code}: ${note.trim()}`,
    link:    `/tactic-documents/${id}`,
  })

  revalidatePath('/tactic-documents')
  revalidatePath(`/tactic-documents/${id}`)
}

export async function deleteTacticDocument(id: string) {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('tactic_documents')
    .select('created_by, status')
    .eq('id', id)
    .single()

  if (!doc) throw new Error('Not found')
  if (doc.created_by !== profile.id && profile.role !== 'admin')
    throw new Error('Not authorized')
  if (!['draft', 'revision_needed'].includes(doc.status))
    throw new Error('Only draft documents can be deleted')

  await supabase.from('tactic_documents').delete().eq('id', id)

  revalidatePath('/tactic-documents')
  redirect('/tactic-documents')
}
