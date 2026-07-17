'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { reviewLeaveRequest } from '@/lib/actions/leave'
import { LEAVE_STATUS_LABEL, LEAVE_STATUS_VARIANT } from '@/lib/leave-utils'
import { LEAVE_STATUSES } from '@/lib/types'
import type { LeaveRequest } from '@/lib/types'

export interface TeamLeaveRow extends LeaveRequest {
  employee: { id: string; full_name: string; employee_code: string }
}

interface Props {
  initialRequests: TeamLeaveRow[]
}

export function TeamLeaveTable({ initialRequests }: Props) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [isPending, start] = useTransition()

  const filtered = statusFilter === 'all'
    ? initialRequests
    : initialRequests.filter(r => r.status === statusFilter)

  function handleReview(id: string, decision: 'approved' | 'rejected') {
    start(async () => {
      const res = await reviewLeaveRequest(id, decision)
      if (!res.error) router.refresh()
    })
  }

  const columns: TableColumn<TeamLeaveRow>[] = [
    {
      id: 'employee',
      accessorFn: (r) => `${r.employee.full_name} ${r.employee.employee_code}`,
      header: 'Employee',
      cell: ({ row: { original: r } }) => (
        <div>
          <p className="font-medium text-neutral-900">{r.employee.full_name}</p>
          <p className="font-mono text-[11px] text-neutral-400">{r.employee.employee_code}</p>
        </div>
      ),
    },
    {
      id: 'dates',
      accessorFn: (r) => `${r.start_date} ${r.end_date}`,
      header: 'Dates',
      cell: ({ row: { original: r } }) => (
        <div>
          <p className="text-sm text-neutral-800">
            {r.start_date === r.end_date ? r.start_date : `${r.start_date} → ${r.end_date}`}
          </p>
          {r.half_day && (
            <p className="text-xs text-neutral-400">Half day · {r.half_day_period}</p>
          )}
        </div>
      ),
    },
    {
      id: 'reason',
      accessorKey: 'reason',
      header: 'Reason',
      enableSorting: false,
      cell: ({ getValue }) => (
        <p className="max-w-xs truncate text-sm text-neutral-600" title={getValue<string>()}>
          {getValue<string>()}
        </p>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const s = getValue<TeamLeaveRow['status']>()
        return <Badge variant={LEAVE_STATUS_VARIANT[s]}>{LEAVE_STATUS_LABEL[s]}</Badge>
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row: { original: r } }) =>
        r.status === 'pending' ? (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" disabled={isPending} onClick={() => handleReview(r.id, 'rejected')}>
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
            <Button size="sm" disabled={isPending} onClick={() => handleReview(r.id, 'approved')}>
              <Check className="h-3.5 w-3.5" />
              Approve
            </Button>
          </div>
        ) : null,
    },
  ]

  const toolbar = (
    <select
      value={statusFilter}
      onChange={e => setStatusFilter(e.target.value)}
      className="h-8 appearance-none rounded border border-neutral-300 bg-white pl-2 pr-6 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
    >
      <option value="all">All statuses</option>
      {LEAVE_STATUSES.map(s => (
        <option key={s} value={s}>{LEAVE_STATUS_LABEL[s]}</option>
      ))}
    </select>
  )

  return (
    <DataTable
      data={filtered}
      columns={columns}
      searchPlaceholder="Search by employee…"
      emptyMessage="No leave requests found."
      toolbar={toolbar}
    />
  )
}
