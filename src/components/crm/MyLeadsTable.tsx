'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { updateLeadStatus } from '@/lib/actions/leads'
import { LEAD_STATUS_LABEL } from '@/lib/leads-utils'
import { LEAD_STATUSES } from '@/lib/types'
import type { Lead, LeadStatus } from '@/lib/types'

export interface MyLeadRow {
  id:         string
  created_at: string
  lead:       Lead
}

interface Props {
  initialAssignments: MyLeadRow[]
}

export function MyLeadsTable({ initialAssignments }: Props) {
  const router = useRouter()
  const [isPending, start] = useTransition()

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

  const columns: TableColumn<MyLeadRow>[] = [
    {
      id: 'contact',
      accessorFn: (row) => `${row.lead.first_name} ${row.lead.last_name} ${row.lead.email} ${row.lead.company ?? ''}`,
      header: 'Contact',
      cell: ({ row: { original: r } }) => (
        <div>
          <p className="font-medium text-neutral-900">{r.lead.first_name} {r.lead.last_name}</p>
          <p className="text-xs text-neutral-400">{r.lead.email}</p>
          {r.lead.company && <p className="text-xs text-neutral-400">{r.lead.company}</p>}
        </div>
      ),
    },
    {
      id: 'website',
      accessorFn: (row) => `${row.lead.website_name} ${row.lead.inquiry_type ?? ''}`,
      header: 'Source',
      cell: ({ row: { original: r } }) => (
        <div>
          <p className="text-sm text-neutral-700">{r.lead.website_name}</p>
          {r.lead.inquiry_type && <p className="text-xs text-neutral-400">{r.lead.inquiry_type}</p>}
        </div>
      ),
    },
    {
      id: 'message',
      accessorFn: (row) => row.lead.message,
      header: 'Message',
      enableSorting: false,
      cell: ({ row: { original: r } }) => (
        <p className="max-w-xs truncate text-sm text-neutral-600" title={r.lead.message}>
          {r.lead.message}
        </p>
      ),
    },
    {
      id: 'status',
      accessorFn: (row) => row.lead.status,
      header: 'Status',
      cell: ({ row: { original: r } }) => (
        <select
          value={r.lead.status}
          disabled={isPending}
          onChange={e => handleStatusChange(r.lead.id, e.target.value as LeadStatus)}
          className="h-8 rounded border border-neutral-300 bg-white px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          {LEAD_STATUSES.map(s => (
            <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>
          ))}
        </select>
      ),
    },
    {
      id: 'assigned_at',
      accessorKey: 'created_at',
      header: 'Assigned',
      cell: ({ getValue }) => (
        <span className="text-xs text-neutral-400">
          {new Date(getValue<string>()).toLocaleDateString()}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      data={initialAssignments}
      columns={columns}
      searchPlaceholder="Search by name, email, or company…"
      emptyMessage="No leads assigned to you yet."
    />
  )
}
