'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, X } from 'lucide-react'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cancelLeaveRequest } from '@/lib/actions/leave'
import { LEAVE_STATUS_LABEL, LEAVE_STATUS_VARIANT } from '@/lib/leave-utils'
import type { LeaveRequest } from '@/lib/types'
import { RequestLeaveDialog } from './RequestLeaveDialog'

export type MyLeaveRow = LeaveRequest

interface Props {
  initialRequests: MyLeaveRow[]
}

export function MyLeaveTable({ initialRequests }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, start] = useTransition()

  function handleCancel(id: string) {
    start(async () => {
      await cancelLeaveRequest(id)
      router.refresh()
    })
  }

  const columns: TableColumn<MyLeaveRow>[] = [
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
        const s = getValue<MyLeaveRow['status']>()
        return <Badge variant={LEAVE_STATUS_VARIANT[s]}>{LEAVE_STATUS_LABEL[s]}</Badge>
      },
    },
    {
      id: 'review_note',
      accessorFn: (r) => r.review_note ?? '',
      header: 'Reviewer note',
      enableSorting: false,
      cell: ({ row: { original: r } }) =>
        r.review_note ? (
          <p className="max-w-xs truncate text-sm text-neutral-500" title={r.review_note}>{r.review_note}</p>
        ) : (
          <span className="text-xs text-neutral-300">—</span>
        ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row: { original: r } }) =>
        r.status === 'pending' ? (
          <Button variant="ghost" size="sm" disabled={isPending} onClick={() => handleCancel(r.id)}>
            <X className="h-3.5 w-3.5" />
            Withdraw
          </Button>
        ) : null,
    },
  ]

  const toolbar = (
    <Button size="sm" onClick={() => setOpen(true)}>
      <Plus className="h-3.5 w-3.5" />
      Request leave
    </Button>
  )

  return (
    <>
      <DataTable
        data={initialRequests}
        columns={columns}
        searchPlaceholder="Search leave requests…"
        emptyMessage="No leave requests yet."
        toolbar={toolbar}
      />

      <RequestLeaveDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
