import { notFound, redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { EmployeeDetail } from '@/components/employees/EmployeeDetail'
import type { EmployeeDetailData } from '@/components/employees/EmployeeDetail'

interface Props {
  params: { id: string }
}

export async function generateMetadata() {
  return { title: `Employee — WSSO` }
}

export default async function EmployeeDetailPage({ params }: Props) {
  const viewer = await requireProfile()

  if (!['admin', 'manager'].includes(viewer.role)) redirect('/dashboard')

  // Regular RLS-scoped client — manager can only see employees on their team
  const supabase = await createClient()

  const [profileRes, teamsRes, companiesRes, ecRes, managersRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', params.id).single(),
    supabase.from('teams').select('id, name, code, manager_id').order('name'),
    supabase.from('companies').select('id, name, code').order('name'),
    supabase
      .from('employee_companies')
      .select('company_id')
      .eq('employee_id', params.id),
    supabase
      .from('profiles')
      .select('id, full_name, employee_code')
      .eq('role', 'manager')
      .order('full_name'),
  ])

  // RLS returns null if the requesting user cannot see this profile
  if (!profileRes.data) notFound()

  const p          = profileRes.data
  const teams      = teamsRes.data     ?? []
  const companies  = companiesRes.data ?? []
  const managers   = managersRes.data  ?? []
  const currentCompanyIds = (ecRes.data ?? []).map((r) => r.company_id)

  // Attach the team and manager objects (looked up from the already-fetched lists)
  const teamMap    = Object.fromEntries(teams.map((t) => [t.id, t]))
  const managerMap = Object.fromEntries(
    managers.map((m) => [m.id, m]),
  )

  const employee: EmployeeDetailData = {
    ...p,
    team:              p.team_id    ? (teamMap[p.team_id]       ?? null) : null,
    manager:           p.manager_id ? (managerMap[p.manager_id] ?? null) : null,
    currentCompanyIds,
  }

  return (
    <EmployeeDetail
      employee={employee}
      teams={teams}
      companies={companies}
      managers={managers}
      isAdmin={viewer.role === 'admin'}
    />
  )
}
