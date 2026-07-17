'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus } from 'lucide-react'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { updateLeadStatus } from '@/lib/actions/leads'
import { LEAD_STATUS_LABEL } from '@/lib/leads-utils'
import { LEAD_STATUSES } from '@/lib/types'
import type { Lead, LeadStatus } from '@/lib/types'
import { AssignLeadDialog } from './AssignLeadDialog'

export interface LeadRow extends Lead {
  assignments: {
    id:         string
    created_at: string
    employee:   { id: string; full_name: string; employee_code: string; role: string }
  }[]
}

interface Props {
  initialLeads: LeadRow[]
}

export function LeadsTable({ initialLeads }: Props) {
  const router = useRouter()
  const [assignTarget, setAssignTarget] = useState<LeadRow | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [isPending, start] = useTransition()

  const filtered = statusFilter === 'all'
    ? initialLeads
    : initialLeads.filter(l => l.status === statusFilter)

  function handleStatusChange(leadId: string, status: LeadStatus) {
    start(async () => {
      try {
        await updateLeadStatus(leadId, status)
        router.refresh()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to update status')
      }
    })
  }

  const columns: TableColumn<LeadRow>[] = [
    {
      id: 'contact',
      accessorFn: (row) => `${row.first_name} ${row.last_name} ${row.email} ${row.company ?? ''}`,
      header: 'Contact',
      cell: ({ row: { original: l } }) => (
        <div>
          <p className="font-medium text-neutral-900">{l.first_name} {l.last_name}</p>
          <p className="text-xs text-neutral-400">{l.email}</p>
          {l.company && <p className="text-xs text-neutral-400">{l.company}</p>}
        </div>
      ),
    },
    {
      id: 'website',
      accessorFn: (row) => `${row.website_name} ${row.inquiry_type ?? ''}`,
      header: 'Source',
      cell: ({ row: { original: l } }) => (
        <div>
          <p className="text-sm text-neutral-700">{l.website_name}</p>
          {l.inquiry_type && <p className="text-xs text-neutral-400">{l.inquiry_type}</p>}
        </div>
      ),
    },
    {
      id: 'message',
      accessorKey: 'message',
      header: 'Message',
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
      cell: ({ row: { original: l } }) => (
        <select
          value={l.status}
          disabled={isPending}
          onChange={e => handleStatusChange(l.id, e.target.value as LeadStatus)}
          className="h-8 rounded border border-neutral-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {LEAD_STATUSES.map(s => (
            <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>
          ))}
        </select>
      ),
    },
    {
      id: 'assigned',
      accessorFn: (row) => row.assignments.map(a => a.employee.full_name).join(' '),
      header: 'Assigned to',
      enableSorting: false,
      cell: ({ row: { original: l } }) =>
        l.assignments.length === 0 ? (
          <Badge variant="warning">Unassigned</Badge>
        ) : (
          <div className="flex flex-wrap gap-1">
            {l.assignments.map(a => (
              <span
                key={a.id}
                className="rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] text-neutral-600"
              >
                {a.employee.full_name}
              </span>
            ))}
          </div>
        ),
    },
    {
      accessorKey: 'created_at',
      header: 'Received',
      cell: ({ getValue }) => (
        <span className="text-xs text-neutral-400">
          {new Date(getValue<string>()).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row: { original: l } }) => (
        <Button variant="ghost" size="sm" onClick={() => setAssignTarget(l)}>
          <UserPlus className="h-3.5 w-3.5" />
          Assign
        </Button>
      ),
    },
  ]

  const toolbar = (
    <select
      value={statusFilter}
      onChange={e => setStatusFilter(e.target.value)}
      className="h-8 appearance-none rounded border border-neutral-300 bg-white pl-2 pr-6 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
    >
      <option value="all">All statuses</option>
      {LEAD_STATUSES.map(s => (
        <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>
      ))}
    </select>
  )

  return (
    <>
      <DataTable
        data={filtered}
        columns={columns}
        searchPlaceholder="Search by name, email, or company…"
        emptyMessage="No leads yet."
        toolbar={toolbar}
      />

      {assignTarget && (
        <AssignLeadDialog
          lead={assignTarget}
          open={!!assignTarget}
          onClose={() => { setAssignTarget(null); router.refresh() }}
        />
      )}
    </>
  )
}
