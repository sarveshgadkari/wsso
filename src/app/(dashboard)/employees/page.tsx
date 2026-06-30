import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EmployeeTable } from '@/components/employees/EmployeeTable'
import type { EmployeeListRow } from '@/components/employees/EmployeeTable'

export const metadata = { title: 'Employees — WSSO' }

export default async function EmployeesPage() {
  const profile = await requireProfile()

  // Only admin and manager can reach this page
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  // Use the regular (RLS-scoped) client — never the service-role client.
  // Admin sees all profiles; manager automatically sees only their team's profiles.
  const supabase = await createClient()

  const [profilesRes, teamsRes, companiesRes, ecRes] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('teams').select('id, name, code, manager_id').order('name'),
    supabase.from('companies').select('id, name, code').order('name'),
    supabase.from('employee_companies').select('employee_id, company_id'),
  ])

  const profiles  = profilesRes.data  ?? []
  const teams     = teamsRes.data     ?? []
  const companies = companiesRes.data ?? []
  const ecLinks   = ecRes.data        ?? []

  // Build lookup maps
  const teamMap    = Object.fromEntries(teams.map((t) => [t.id, t]))
  const managerMap = Object.fromEntries(
    profiles.map((p) => [p.id, { id: p.id, full_name: p.full_name, employee_code: p.employee_code }]),
  )

  const companyIdsByEmployee: Record<string, string[]> = {}
  ecLinks.forEach(({ employee_id, company_id }) => {
    if (!companyIdsByEmployee[employee_id]) companyIdsByEmployee[employee_id] = []
    companyIdsByEmployee[employee_id].push(company_id)
  })

  const employeeRows: EmployeeListRow[] = profiles.map((p) => ({
    ...p,
    team:       p.team_id    ? (teamMap[p.team_id]       ?? null) : null,
    manager:    p.manager_id ? (managerMap[p.manager_id] ?? null) : null,
    companyIds: companyIdsByEmployee[p.id] ?? [],
  }))

  const managers = profiles.filter((p) => p.role === 'manager')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Employees</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {profile.role === 'manager'
            ? 'Showing your team members only.'
            : 'All employees across the organisation.'}
        </p>
      </div>

      <EmployeeTable
        initialEmployees={employeeRows}
        teams={teams}
        companies={companies}
        managers={managers}
        isAdmin={profile.role === 'admin'}
      />
    </div>
  )
}
