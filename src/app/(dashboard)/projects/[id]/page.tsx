import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ProjectDetailShell } from '@/components/projects/ProjectDetailShell'
import type { ProjectRow } from '@/components/projects/ProjectDialog'
import type { TacticRow } from '@/components/tactics/TacticDialog'

interface Props {
  params: { id: string }
}

export async function generateMetadata() {
  return { title: 'Project — WSSO' }
}

export default async function ProjectDetailPage({ params }: Props) {
  const profile = await requireProfile()

  // Employees can reach this page via RLS if their tactics reference this project.
  // Admin and manager have full access.
  const supabase = await createClient()

  const [projectRes, companiesRes, clientsRes, managersRes, tacticsRes] = await Promise.all([
    supabase
      .from('projects')
      .select(`
        *,
        company:companies(id, name, code),
        client:clients(id, name, code),
        manager:profiles!manager_id(id, full_name, employee_code)
      `)
      .eq('id', params.id)
      .single(),
    supabase.from('companies').select('id, name, code').order('name'),
    supabase.from('clients').select('id, name, code, company_id').order('name'),
    supabase
      .from('profiles')
      .select('id, full_name, employee_code')
      .eq('role', 'manager')
      .eq('status', 'active')
      .order('full_name'),
    supabase
      .from('tactics')
      .select(`
        *,
        project:projects!tactics_project_id_fkey(id, name, code),
        assignee:profiles!tactics_assigned_to_fkey(id, full_name, employee_code),
        creator:profiles!tactics_created_by_fkey(id, full_name, employee_code)
      `)
      .eq('project_id', params.id)
      .order('created_at', { ascending: false }),
  ])

  // RLS returns null if this user cannot see the project
  if (!projectRes.data) notFound()

  const project   = projectRes.data  as unknown as ProjectRow
  const companies = companiesRes.data ?? []
  const clients   = clientsRes.data   ?? []
  const managers  = managersRes.data  ?? []
  const tactics   = (tacticsRes.data ?? []) as unknown as TacticRow[]

  const isAdmin = profile.role === 'admin'
  // Managers can edit projects they own; admins can edit all
  const canEdit =
    isAdmin ||
    (profile.role === 'manager' && project.manager_id === profile.id)

  return (
    <ProjectDetailShell
      project={project}
      companies={companies}
      clients={clients}
      managers={managers}
      isAdmin={isAdmin}
      canEdit={canEdit}
      currentUserId={profile.id}
      tactics={tactics}
    />
  )
}
