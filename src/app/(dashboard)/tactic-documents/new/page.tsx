import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { TacticDocumentForm } from '@/components/tactic-documents/TacticDocumentForm'

export const metadata = { title: 'New TACTIC — WSSO' }

export default async function NewTacticDocumentPage() {
  const profile  = await requireProfile()
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
    // Page still renders — user can fill form; dropdowns may be empty
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">New TACTIC Document</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Record meeting outputs: tasks, decisions, background, and next steps.
        </p>
      </div>

      <TacticDocumentForm
        employees={employees}
        companies={companies}
        projects={projects}
        currentUserName={profile.full_name ?? 'Me'}
      />
    </div>
  )
}
