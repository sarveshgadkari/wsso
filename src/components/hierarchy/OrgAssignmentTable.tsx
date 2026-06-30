'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, AlertCircle } from 'lucide-react'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { OrgAssignmentDialog, type EmployeeOrgRow } from './OrgAssignmentDialog'
import { useToast } from '@/lib/store/toast'
import type { Company, Profile } from '@/lib/types'
import type { TeamRow } from '@/components/teams/TeamDialog'

const ROLE_VARIANT: Record<string, 'info' | 'purple' | 'default' | 'warning'> = {
  admin:    'danger' as never,
  director: 'purple',
  manager:  'info',
  employee: 'default',
}

interface OrgAssignmentTableProps {
  initialEmployees: EmployeeOrgRow[]
  teams:     Pick<TeamRow, 'id' | 'name' | 'code' | 'manager_id'>[]
  managers:  Pick<Profile, 'id' | 'full_name' | 'employee_code'>[]
  companies: Pick<Company, 'id' | 'name' | 'code'>[]
}

export function OrgAssignmentTable({
  initialEmployees, teams, managers, companies,
}: OrgAssignmentTableProps) {
  const router = useRouter()
  const toast  = useToast()

  const [employees, setEmployees] = useState<EmployeeOrgRow[]>(initialEmployees)
  const [editing,   setEditing]   = useState<EmployeeOrgRow | null>(null)

  const handleSaved = (updated: EmployeeOrgRow) => {
    setEmployees((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e))
    )
    toast.success(`${updated.full_name}'s assignment saved`)
    router.refresh()
  }

  // Build lookup maps for display
  const teamMap    = Object.fromEntries(teams.map((t) => [t.id, t]))
  const managerMap = Object.fromEntries(managers.map((m) => [m.id, m]))
  const companyMap = Object.fromEntries(companies.map((c) => [c.id, c]))

  const columns: TableColumn<EmployeeOrgRow>[] = [
    {
      accessorKey: 'full_name',
      header: 'Employee',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-neutral-900">{row.original.full_name}</p>
          <p className="font-mono text-[11px] text-neutral-400">{row.original.employee_code}</p>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ getValue }) => {
        const role = getValue<string>()
        return (
          <Badge variant={ROLE_VARIANT[role] ?? 'default'} className="capitalize">
            {role}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'department',
      header: 'Dept',
      cell: ({ getValue }) => (
        <span className="text-sm text-neutral-600">{getValue<string | null>() ?? '—'}</span>
      ),
    },
    {
      id: 'team',
      header: 'Team',
      accessorFn: (row) => teamMap[row.team_id ?? '']?.name ?? '',
      cell: ({ row }) => {
        const team = teamMap[row.original.team_id ?? '']
        if (!team) return <span className="text-neutral-400">—</span>
        return (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-neutral-400">{team.code}</span>
            <span className="text-sm">{team.name}</span>
            {!team.manager_id && (
              <AlertCircle className="h-3.5 w-3.5 text-warning-500" aria-label="Team has no manager" />
            )}
          </div>
        )
      },
    },
    {
      id: 'manager',
      header: 'Direct manager',
      accessorFn: (row) => managerMap[row.manager_id ?? '']?.full_name ?? '',
      cell: ({ row }) => {
        const mgr = managerMap[row.original.manager_id ?? '']
        return mgr ? (
          <span className="text-sm">{mgr.full_name}</span>
        ) : (
          <span className="text-neutral-400">—</span>
        )
      },
    },
    {
      id: 'companies',
      header: 'Companies',
      enableSorting: false,
      cell: ({ row }) => {
        const codes = row.original.currentCompanyIds
          .map((id) => companyMap[id]?.code)
          .filter(Boolean)
        return codes.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {codes.map((code) => (
              <span key={code} className="font-mono text-[11px] bg-neutral-100 text-neutral-600 rounded px-1.5 py-0.5">
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
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(row.original)}
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      ),
    },
  ]

  return (
    <>
      <DataTable
        data={employees}
        columns={columns}
        searchPlaceholder="Search employees…"
        emptyMessage="No employees found."
      />

      <OrgAssignmentDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        onSaved={handleSaved}
        employee={editing}
        teams={teams}
        managers={managers}
        companies={companies}
      />
    </>
  )
}
