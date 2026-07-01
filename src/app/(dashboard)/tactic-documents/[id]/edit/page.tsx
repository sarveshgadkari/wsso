import { notFound, redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TacticDocumentForm } from '@/components/tactic-documents/TacticDocumentForm'

export const metadata = { title: 'Edit TACTIC — WSSO' }

interface Props {
  params: { id: string }
}

export default async function EditTacticDocumentPage({ params }: Props) {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('tactic_documents')
    .select(`
      id, code, status, created_by,
      date_of_meeting, time_of_meeting, facilitator, location, attendees,
      purpose, background_info, takeaways,
      company_id, project_id, tactic_id
    `)
    .eq('id', params.id)
    .single()

  if (!doc) notFound()

  // Only creator or admin can edit; only draft/revision_needed status allowed
  const canEdit =
    (doc.created_by === profile.id || profile.role === 'admin') &&
    ['draft', 'revision_needed'].includes(doc.status)

  if (!canEdit) redirect(`/tactic-documents/${params.id}`)

  // Fetch tasks and next steps for pre-fill
  const [tasksRes, stepsRes] = await Promise.all([
    supabase
      .from('tactic_tasks')
      .select('id, order_no, title, description, status, assigned_to, owner_name, target_date')
      .eq('tactic_document_id', params.id)
      .order('order_no'),
    supabase
      .from('tactic_next_steps')
      .select('id, order_no, description, owner, owner_name, due_date')
      .eq('tactic_document_id', params.id)
      .order('order_no'),
  ])

  const [employeesRes, companiesRes, projectsRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, full_name, employee_code')
      .eq('status', 'active')
      .order('full_name'),
    supabase.from('companies').select('id, name, code').order('name'),
    supabase.from('projects').select('id, name, code').eq('status', 'active').order('name'),
  ])

  const employees = (employeesRes.data ?? []) as { id: string; full_name: string; employee_code: string }[]
  const companies = (companiesRes.data ?? []) as { id: string; name: string; code: string }[]
  const projects  = (projectsRes.data  ?? []) as { id: string; name: string; code: string }[]

  const initialDoc = {
    id:             doc.id,
    code:           doc.code,
    status:         doc.status,
    date_of_meeting: doc.date_of_meeting ?? '',
    time_of_meeting: doc.time_of_meeting ?? '',
    facilitator:    doc.facilitator ?? '',
    location:       doc.location ?? '',
    attendees:      doc.attendees ?? '',
    purpose:        doc.purpose,
    background_info: doc.background_info ?? '',
    takeaways:      doc.takeaways ?? '',
    company_id:     doc.company_id ?? '',
    project_id:     doc.project_id ?? '',
    tactic_id:      doc.tactic_id  ?? '',
    tasks: (tasksRes.data ?? []).map((t: {
      id: string; order_no: number; title: string; description: string
      status: 'pending' | 'in_progress' | 'completed'
      assigned_to: string | null; owner_name: string | null; target_date: string | null
    }) => ({
      _key:        t.id,
      title:       t.title,
      description: t.description,
      status:      t.status,
      assigned_to: t.assigned_to ?? '',
      owner_name:  t.owner_name  ?? '',
      target_date: t.target_date ?? '',
      order_no:    t.order_no,
    })),
    next_steps: (stepsRes.data ?? []).map((ns: {
      id: string; order_no: number; description: string
      owner: string | null; owner_name: string | null; due_date: string | null
    }) => ({
      _key:        ns.id,
      description: ns.description,
      owner:       ns.owner      ?? '',
      owner_name:  ns.owner_name ?? '',
      due_date:    ns.due_date   ?? '',
      order_no:    ns.order_no,
    })),
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">
          Edit TACTIC — <span className="font-mono text-primary-700">{doc.code}</span>
        </h2>
        {doc.status === 'revision_needed' && (
          <p className="mt-1 text-sm text-warning-700">
            This document has been sent back for revision. Make your changes and re-submit.
          </p>
        )}
      </div>

      <TacticDocumentForm
        employees={employees}
        companies={companies}
        projects={projects}
        currentUserName={profile.full_name}
        initialDoc={initialDoc}
      />
    </div>
  )
}
