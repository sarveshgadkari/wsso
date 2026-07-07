import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import {
  TacticDocumentDetail,
  type TacticDocFull,
} from '@/components/tactic-documents/TacticDocumentDetail'
import { canManagerReviewEmployeeTacticDoc, getTacticDocumentShares } from '@/lib/actions/tactic-documents'

interface Props {
  params: { id: string }
}

export async function generateMetadata() {
  return { title: 'TACTIC Document — WSSO' }
}

export default async function TacticDocumentPage({ params }: Props) {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { data: raw } = await supabase
    .from('tactic_documents')
    .select(`
      id, code,
      date_of_meeting, time_of_meeting, facilitator, location, attendees,
      purpose, background_info, takeaways,
      status, reviewer_id, review_note, submitted_at, reviewed_at,
      created_by, created_at,
      creator:profiles!tactic_documents_created_by_fkey(id, full_name, role, employee_code, manager_id),
      reviewer:profiles!tactic_documents_reviewer_id_fkey(id, full_name, role),
      company:companies!tactic_documents_company_id_fkey(id, name, code),
      project:projects!tactic_documents_project_id_fkey(id, name, code)
    `)
    .eq('id', params.id)
    .single()

  if (!raw) notFound()

  // Fetch tasks and next steps separately (Supabase join arrays)
  const [tasksRes, stepsRes] = await Promise.all([
    supabase
      .from('tactic_tasks')
      .select(`
        id, order_no, title, description, status,
        assigned_to, owner_name, target_date,
        assignee:profiles!tactic_tasks_assigned_to_fkey(full_name)
      `)
      .eq('tactic_document_id', params.id)
      .order('order_no'),
    supabase
      .from('tactic_next_steps')
      .select(`
        id, order_no, description, owner, owner_name, due_date, completed,
        owner_profile:profiles!tactic_next_steps_owner_fkey(full_name)
      `)
      .eq('tactic_document_id', params.id)
      .order('order_no'),
  ])

  const doc: TacticDocFull = {
    ...(raw as unknown as TacticDocFull),
    tasks:      (tasksRes.data ?? []) as unknown as TacticDocFull['tasks'],
    next_steps: (stepsRes.data ?? []) as unknown as TacticDocFull['next_steps'],
  }

  let canReview = false
  let shares: Awaited<ReturnType<typeof getTacticDocumentShares>> = []

  if (doc.created_by === profile.id || profile.role === 'admin') {
    shares = await getTacticDocumentShares(doc.id)
  }

  if (doc.status === 'submitted') {
    if (profile.role === 'admin' && doc.creator.role === 'manager') {
      canReview = true
    } else if (profile.role === 'manager') {
      canReview = await canManagerReviewEmployeeTacticDoc(profile.id, {
        id:         doc.creator.id,
        role:       doc.creator.role,
        manager_id: (doc.creator as { manager_id?: string | null }).manager_id ?? null,
      })
    }
  }

  return (
    <TacticDocumentDetail
      doc={doc}
      currentUserId={profile.id}
      role={profile.role}
      canReview={canReview}
      shares={shares}
    />
  )
}
