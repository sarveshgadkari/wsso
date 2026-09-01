import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { RoleGuard } from '@/components/auth/RoleGuard'
import { WorkspaceSettingsShell } from '@/components/workspace/WorkspaceSettingsShell'
import { mergeWorkspaceSettings } from '@/lib/workspace/settings'
import {
  listCatalog,
  listChecklistTemplates,
  listEmployeeSkillsMap,
  listFieldDefinitions,
  listHolidays,
  listLocations,
} from '@/lib/actions/workspace'
import { listRecurringJobs } from '@/lib/actions/ops'
import type { CatalogKind } from '@/lib/workspace/settings'
import type { OrgCatalogItem } from '@/lib/workspace/rows'

export const metadata = { title: 'Workspace settings — WSSO' }

const CATALOG_KINDS: CatalogKind[] = [
  'leave_type', 'win_reason', 'lost_reason', 'skill', 'compliance_type', 'work_order_type',
]

export default async function WorkspaceSettingsPage() {
  await requireRole(['admin'])
  const supabase = await createClient()

  const [companiesRes, teamsRes, profilesRes, ecRes, orgRes, projectsRes] = await Promise.all([
    supabase.from('companies').select('id, name, code').order('name'),
    supabase
      .from('teams')
      .select('id, code, name, company_id, manager_id, created_at, company:companies(id,name,code), manager:profiles!manager_id(id,full_name,employee_code)')
      .order('name'),
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('employee_companies').select('employee_id, company_id'),
    supabase.from('organizations').select('settings').maybeSingle(),
    supabase.from('projects').select('id, name, code').eq('status', 'active').order('name'),
  ])

  const companies = companiesRes.data ?? []
  const teams = teamsRes.data ?? []
  const profiles = profilesRes.data ?? []
  const ecLinks = ecRes.data ?? []
  const managers = profiles.filter((p) => p.role === 'manager' || p.role === 'admin')

  const memberCountMap: Record<string, number> = {}
  profiles.forEach((p) => {
    if (p.team_id) memberCountMap[p.team_id] = (memberCountMap[p.team_id] ?? 0) + 1
  })
  const teamsWithCount = (teams as unknown[]).map((t) => {
    const team = t as { id: string; [key: string]: unknown }
    return { ...team, memberCount: memberCountMap[team.id] ?? 0 }
  })

  const companyIdsByEmployee: Record<string, string[]> = {}
  ecLinks.forEach(({ employee_id, company_id }) => {
    if (!companyIdsByEmployee[employee_id]) companyIdsByEmployee[employee_id] = []
    companyIdsByEmployee[employee_id].push(company_id)
  })
  const employeeRows = profiles.map((p) => ({
    ...p,
    currentCompanyIds: companyIdsByEmployee[p.id] ?? [],
  }))

  const catalogChunks = await Promise.all(CATALOG_KINDS.map((k) => listCatalog(k)))
  const catalog: OrgCatalogItem[] = catalogChunks.flat()
  const [locations, holidays, fields, checklists, skillsByEmployee, recurring] = await Promise.all([
    listLocations(),
    listHolidays(),
    listFieldDefinitions(),
    listChecklistTemplates(),
    listEmployeeSkillsMap(),
    listRecurringJobs(),
  ])

  const sqlReady = catalog.length > 0 || locations.length > 0 || fields.length > 0 || checklists.length > 0

  return (
    <RoleGuard allow={['admin']}>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Workspace settings</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Configure this company without custom code: features, overtime, leave types, locations, checklists, and pay rates.
          </p>
        </div>
        <WorkspaceSettingsShell
          data={{
            settings: mergeWorkspaceSettings(orgRes.data?.settings),
            teams: teamsWithCount as never,
            companies,
            managers,
            employees: employeeRows,
            catalog,
            locations,
            holidays,
            fields,
            checklists,
            skillsByEmployee,
            projects: projectsRes.data ?? [],
            recurring,
            sqlReady,
          }}
        />
      </div>
    </RoleGuard>
  )
}
