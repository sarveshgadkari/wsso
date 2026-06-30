'use client'

import { useRouter } from 'next/navigation'
import { AlertTriangle, ChevronRight, Dot } from 'lucide-react'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDuration } from './TimeLogTable'

export interface EmployeeTimeStats {
  id:             string
  employee_code:  string
  full_name:      string
  team_name:      string | null
  todayMinutes:   number
  weekMinutes:    number
  monthMinutes:   number
  autoLogouts:    number
  isActiveNow:    boolean
}

interface Props {
  employees: EmployeeTimeStats[]
  isAdmin:   boolean
}

export function TeamTimeTable({ employees }: Props) {
  const router = useRouter()

  const columns: TableColumn<EmployeeTimeStats>[] = [
    {
      id: 'employee',
      accessorFn: (r) => `${r.full_name} ${r.employee_code}`,
      header: 'Employee',
      cell: ({ row: { original: e } }) => (
        <div>
          <div className="flex items-center gap-1.5">
            {e.isActiveNow && (
              <Dot className="-ml-1 h-5 w-5 animate-pulse text-success-500" />
            )}
            <p className="font-medium text-neutral-900">{e.full_name}</p>
          </div>
          <p className="font-mono text-[11px] text-neutral-400">{e.employee_code}</p>
          {e.team_name && (
            <p className="text-[11px] text-neutral-400">{e.team_name}</p>
          )}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Now',
      enableSorting: false,
      cell: ({ row: { original: e } }) =>
        e.isActiveNow ? (
          <Badge variant="success">Clocked in</Badge>
        ) : (
          <span className="text-xs text-neutral-400">—</span>
        ),
    },
    {
      accessorKey: 'todayMinutes',
      header: 'Today',
      cell: ({ getValue }) => {
        const m = getValue<number>()
        return m > 0 ? (
          <span className="text-sm font-medium">{formatDuration(m)}</span>
        ) : (
          <span className="text-xs text-neutral-400">0h</span>
        )
      },
    },
    {
      accessorKey: 'weekMinutes',
      header: 'This week',
      cell: ({ getValue }) => {
        const m = getValue<number>()
        return m > 0 ? (
          <span className="text-sm">{formatDuration(m)}</span>
        ) : (
          <span className="text-xs text-neutral-400">0h</span>
        )
      },
    },
    {
      accessorKey: 'monthMinutes',
      header: 'This month',
      cell: ({ getValue }) => {
        const m = getValue<number>()
        return m > 0 ? (
          <span className="text-sm">{formatDuration(m)}</span>
        ) : (
          <span className="text-xs text-neutral-400">0h</span>
        )
      },
    },
    {
      accessorKey: 'autoLogouts',
      header: 'Auto-logouts',
      cell: ({ getValue }) => {
        const n = getValue<number>()
        return n > 0 ? (
          <Badge variant="warning" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {n}
          </Badge>
        ) : (
          <span className="text-xs text-neutral-300">—</span>
        )
      },
    },
    {
      id: 'view',
      header: '',
      enableSorting: false,
      cell: ({ row: { original: e } }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/time/team/${e.id}`)}
        >
          Sessions
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ]

  return (
    <DataTable
      data={employees}
      columns={columns}
      searchPlaceholder="Search employees…"
      emptyMessage="No employees found."
    />
  )
}
