import { notFound, redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TacticDocumentForm } from '@/components/tactic-documents/TacticDocumentForm'
import {
  canViewTacticDocument,
  fetchTacticDocumentById,
  fetchTacticDocumentNextSteps,
  fetchTacticDocumentTasks,
} from '@/lib/tactic-documents/queries'

export const metadata = { title: 'Edit TACTIC — WSSO' }

interface Props {
  params: { id: string }
}

export default async function EditTacticDocumentPage({ params }: Props) {
  const profile  = await requireProfile()

  const doc = await fetchTacticDocumentById(params.id)
  if (!doc) notFound()

  const allowed = await canViewTacticDocument(profile, params.id, doc.created_by as string)
  if (!allowed) notFound()

  const canEdit =
    (doc.created_by === profile.id || profile.role === 'admin') &&
    ['draft', 'revision_needed'].includes(doc.status as string)

  if (!canEdit) redirect(`/tactic-documents/${params.id}`)

  const [tasks, next_steps] = await Promise.all([
    fetchTacticDocumentTasks(params.id),
    fetchTacticDocumentNextSteps(params.id),
  ])

  const supabase = await createClient()
  let employees: { id: string; full_name: string; employee_code: string }[] = []
  let companies: { id: string; name: string; code: string }[] = []
  let projects:  { id: string; name: string; code: string }[] = []

  try {
    const [employeesRes, companiesRes, projectsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, employee_code')
        .eq('status', 'active')
        .order('full_name'),
      supabase.from('companies').select('id, name, code').order('name'),
      supabase.from('projects').select('id, name, code').eq('status', 'active').order('name'),
    ])
    employees = (employeesRes.data ?? []) as typeof employees
    companies = (companiesRes.data ?? []) as typeof companies
    projects  = (projectsRes.data  ?? []) as typeof projects
  } catch {
    // Dropdowns may be empty — form still usable
  }

  const initialDoc = {
    id:              doc.id,
    code:            doc.code,
    status:          doc.status,
    date_of_meeting: doc.date_of_meeting ?? '',
    time_of_meeting: doc.time_of_meeting ?? '',
    facilitator:     doc.facilitator ?? '',
    location:        doc.location ?? '',
    attendees:       doc.attendees ?? '',
    purpose:         doc.purpose,
    background_info: doc.background_info ?? '',
    takeaways:       doc.takeaways ?? '',
    company_id:      (doc as { company_id?: string | null }).company_id ?? '',
    project_id:      (doc as { project_id?: string | null }).project_id ?? '',
    tactic_id:       (doc as { tactic_id?: string | null }).tactic_id  ?? '',
    tasks: tasks.map((t: {
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
    next_steps: next_steps.map((ns: {
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
        currentUserName={profile.full_name ?? 'Me'}
        initialDoc={initialDoc}
      />
    </div>
  )
}
