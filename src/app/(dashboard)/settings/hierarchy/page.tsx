import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { HierarchyShell } from '@/components/hierarchy/HierarchyShell'

export const metadata = { title: 'Admin Settings — WSSO' }

export default async function HierarchyPage() {
  await requireRole(['admin'])
  const supabase = await createClient()

  // Fetch all data the page needs in parallel
  const [companiesRes, teamsRes, profilesRes, ecRes] = await Promise.all([
    supabase.from('companies').select('id, name, code').order('name'),
    supabase
      .from('teams')
      .select('id, code, name, company_id, manager_id, created_at, company:companies(id,name,code), manager:profiles!manager_id(id,full_name,employee_code)')
      .order('name'),
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('employee_companies').select('employee_id, company_id'),
  ])

  const companies = companiesRes.data ?? []
  const teams     = teamsRes.data     ?? []
  const profiles  = profilesRes.data  ?? []
  const ecLinks   = ecRes.data        ?? []

  // Separate managers from everyone else
  const managers  = profiles.filter((p) => p.role === 'manager')

  // Build member counts per team
  const memberCountMap: Record<string, number> = {}
  profiles.forEach((p) => {
    if (p.team_id) {
      memberCountMap[p.team_id] = (memberCountMap[p.team_id] ?? 0) + 1
    }
  })

  const teamsWithCount = (teams as unknown[]).map((t) => {
    const team = t as { id: string; [key: string]: unknown }
    return { ...team, memberCount: memberCountMap[team.id] ?? 0 }
  })

  // Build employee org rows (all profiles with their current company links)
  const companyIdsByEmployee: Record<string, string[]> = {}
  ecLinks.forEach(({ employee_id, company_id }) => {
    if (!companyIdsByEmployee[employee_id]) companyIdsByEmployee[employee_id] = []
    companyIdsByEmployee[employee_id].push(company_id)
  })

  const employeeRows = profiles.map((p) => ({
    ...p,
    currentCompanyIds: companyIdsByEmployee[p.id] ?? [],
  }))

  return (
    <RoleGuard allow={['admin']}>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Admin Settings — Hierarchy</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Define teams, assign managers, and map employees to their reporting structure
            and companies. These settings control what each user can see across the app.
          </p>
        </div>

        <HierarchyShell
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          teams={teamsWithCount as any}
          companies={companies}
          managers={managers}
          employees={employeeRows}
        />
      </div>
    </RoleGuard>
  )
}
