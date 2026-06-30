'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Plus, UserX } from 'lucide-react'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CreateEmployeeDialog } from './CreateEmployeeDialog'
import type { Profile, Company, Team, UserRole } from '@/lib/types'

export interface EmployeeListRow extends Omit<Profile, 'team_id' | 'manager_id'> {
  team_id:    string | null
  manager_id: string | null
  team:       { id: string; name: string; code: string } | null
  manager:    { id: string; full_name: string; employee_code: string } | null
  companyIds: string[]
}

const ROLE_VARIANT = {
  admin:    'danger',
  director: 'purple',
  manager:  'info',
  employee: 'default',
} as const

type TeamOption    = Pick<Team, 'id' | 'name' | 'code'> & { manager_id: string | null }
type CompanyOption = Pick<Company, 'id' | 'name' | 'code'>
type ManagerOption = Pick<Profile, 'id' | 'full_name' | 'employee_code'>

interface Props {
  initialEmployees: EmployeeListRow[]
  teams:            TeamOption[]
  companies:        CompanyOption[]
  managers:         ManagerOption[]
  isAdmin:          boolean
}

export function EmployeeTable({
  initialEmployees, teams, companies, managers, isAdmin,
}: Props) {
  const router = useRouter()

  const [employees, setEmployees]   = useState<EmployeeListRow[]>(initialEmployees)
  const [createOpen, setCreateOpen] = useState(false)
  const [roleFilter,   setRoleFilter]   = useState<string>('all')
  const [teamFilter,   setTeamFilter]   = useState<string>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const companyMap = useMemo(
    () => Object.fromEntries(companies.map((c) => [c.id, c])),
    [companies],
  )

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (roleFilter    !== 'all' && e.role       !== roleFilter)              return false
      if (teamFilter    !== 'all' && e.team_id    !== teamFilter)              return false
      if (statusFilter  !== 'all' && e.status     !== statusFilter)            return false
      if (companyFilter !== 'all' && !e.companyIds.includes(companyFilter))    return false
      return true
    })
  }, [employees, roleFilter, teamFilter, companyFilter, statusFilter])

  const columns: TableColumn<EmployeeListRow>[] = [
    {
      id: 'employee',
      // Combine name + email + code so the global search bar matches any field
      accessorFn: (row) => `${row.full_name} ${row.email} ${row.employee_code}`,
      header: 'Employee',
      cell: ({ row: { original: e } }) => (
        <div>
          <p className="font-medium text-neutral-900">{e.full_name}</p>
          <p className="text-xs text-neutral-400">{e.email}</p>
          <p className="font-mono text-[11px] text-neutral-300">{e.employee_code}</p>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => {
        const role = getValue<UserRole>()
        return (
          <Badge variant={ROLE_VARIANT[role] ?? 'default'} className="capitalize">
            {role}
          </Badge>
        )
      },
    },
    {
      id: 'team',
      accessorFn: (row) => row.team?.name ?? '',
      header: 'Team',
      cell: ({ row: { original: e } }) =>
        e.team ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-neutral-400">{e.team.code}</span>
            <span className="text-sm">{e.team.name}</span>
          </div>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      id: 'manager',
      accessorFn: (row) => row.manager?.full_name ?? '',
      header: 'Manager',
      cell: ({ row: { original: e } }) =>
        e.manager ? (
          <span className="text-sm">{e.manager.full_name}</span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      id: 'companies',
      header: 'Companies',
      enableSorting: false,
      cell: ({ row: { original: e } }) => {
        const codes = e.companyIds.map((id) => companyMap[id]?.code).filter(Boolean)
        return codes.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {codes.map((code) => (
              <span
                key={code}
                className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-600"
              >
                {code}
              </span>
            ))}
          </div>
        ) : (
          <Badge variant="warning">None</Badge>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const s = getValue<string>()
        return s === 'active' ? (
          <Badge variant="success">Active</Badge>
        ) : (
          <Badge variant="warning">
            <UserX className="mr-1 h-3 w-3" />
            Inactive
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row: { original: e } }) => (
        <Button variant="ghost" size="sm" onClick={() => router.push(`/employees/${e.id}`)}>
          <Eye className="h-3.5 w-3.5" />
          View
        </Button>
      ),
    },
  ]

  const toolbar = (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterSelect
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all',      label: 'All statuses' },
            { value: 'active',   label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />
        <FilterSelect
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: 'all',      label: 'All roles' },
            { value: 'admin',    label: 'Admin' },
            { value: 'director', label: 'Director' },
            { value: 'manager',  label: 'Manager' },
            { value: 'employee', label: 'Employee' },
          ]}
        />
        <FilterSelect
          value={teamFilter}
          onChange={setTeamFilter}
          options={[
            { value: 'all', label: 'All teams' },
            ...teams.map((t) => ({ value: t.id, label: `${t.code} — ${t.name}` })),
          ]}
        />
        <FilterSelect
          value={companyFilter}
          onChange={setCompanyFilter}
          options={[
            { value: 'all', label: 'All companies' },
            ...companies.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
          ]}
        />
      </div>

      {isAdmin && (
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          New employee
        </Button>
      )}
    </>
  )

  return (
    <>
      <DataTable
        data={filtered}
        columns={columns}
        searchPlaceholder="Search by name or email…"
        emptyMessage="No employees match the current filters."
        toolbar={toolbar}
      />

      {isAdmin && (
        <CreateEmployeeDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(profile) => {
            setEmployees((prev) => [
              { ...profile, team: null, manager: null, companyIds: [] },
              ...prev,
            ])
            setCreateOpen(false)
            router.refresh()
          }}
          teams={teams}
          managers={managers}
          companies={companies}
        />
      )}
    </>
  )
}

// Small inline filter select to keep the toolbar tight
function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 appearance-none rounded border border-neutral-300 bg-white pl-2 pr-6 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
