import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ProjectsTable } from '@/components/projects/ProjectsTable'
import type { ProjectRow } from '@/components/projects/ProjectDialog'

export const metadata = { title: 'Projects — WSSO' }

export default async function ProjectsPage() {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  const supabase = await createClient()

  const [projectsRes, companiesRes, clientsRes, managersRes] = await Promise.all([
    supabase
      .from('projects')
      .select(`
        *,
        company:companies(id, name, code),
        client:clients(id, name, code),
        manager:profiles!manager_id(id, full_name, employee_code)
      `)
      .order('created_at', { ascending: false }),
    supabase.from('companies').select('id, name, code').order('name'),
    supabase.from('clients').select('id, name, code, company_id').order('name'),
    supabase
      .from('profiles')
      .select('id, full_name, employee_code')
      .eq('role', 'manager')
      .eq('status', 'active')
      .order('full_name'),
  ])

  const projects  = (projectsRes.data  ?? []) as unknown as ProjectRow[]
  const companies = companiesRes.data  ?? []
  const clients   = clientsRes.data    ?? []
  const managers  = managersRes.data   ?? []

  const isAdmin = profile.role === 'admin'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Projects</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {isAdmin
            ? 'All projects across the organisation. Project codes are auto-generated (PRJ001…).'
            : 'Projects you manage. Project codes are auto-generated (PRJ001…).'}
        </p>
      </div>

      <ProjectsTable
        initialProjects={projects}
        companies={companies}
        clients={clients}
        managers={managers}
        isAdmin={isAdmin}
        currentUserId={profile.id}
      />
    </div>
  )
}
