'use client'

import { useState } from 'react'
import { AlertTriangle, Pencil, Shield } from 'lucide-react'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TimeLogEditDialog } from './TimeLogEditDialog'
import type { TimeLog } from '@/lib/types'

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString([], {
    weekday: 'short',
    month:   'short',
    day:     'numeric',
  })
}

function StatusBadge({ reason, autoClosed }: { reason: string | null; autoClosed: boolean }) {
  if (reason === 'auto_logout') {
    return (
      <Badge variant="warning" className="gap-1 whitespace-nowrap">
        <AlertTriangle className="h-3 w-3" />
        Auto-closed
      </Badge>
    )
  }
  if (reason === 'admin_correction') {
    return autoClosed ? (
      <Badge variant="warning" className="gap-1 whitespace-nowrap">
        <Shield className="h-3 w-3" />
        Force closed
      </Badge>
    ) : (
      <Badge variant="info" className="gap-1 whitespace-nowrap">
        <Shield className="h-3 w-3" />
        Corrected
      </Badge>
    )
  }
  if (reason === 'manual') {
    return <Badge variant="default">Manual</Badge>
  }
  return <Badge variant="success">In progress</Badge>
}

interface Props {
  logs:    TimeLog[]
  isAdmin: boolean
}

export function TimeLogTable({ logs, isAdmin }: Props) {
  const [rows,    setRows]    = useState<TimeLog[]>(logs)
  const [editing, setEditing] = useState<TimeLog | null>(null)

  const adminCol: TableColumn<TimeLog>[] = isAdmin
    ? [
        {
          id: 'edit',
          header: '',
          enableSorting: false,
          cell: ({ row }) =>
            row.original.clock_out_at ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(row.original)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Correct
              </Button>
            ) : null,
        },
      ]
    : []

  const columns: TableColumn<TimeLog>[] = [
    {
      accessorKey: 'log_date',
      header: 'Date',
      cell: ({ getValue }) => (
        <span className="whitespace-nowrap text-sm font-medium text-neutral-800">
          {fmtDate(getValue<string>())}
        </span>
      ),
    },
    {
      accessorKey: 'clock_in_at',
      header: 'Clock in',
      cell: ({ getValue }) => (
        <span className="font-mono text-sm">{fmtTime(getValue<string>())}</span>
      ),
    },
    {
      accessorKey: 'clock_out_at',
      header: 'Clock out',
      cell: ({ getValue }) => {
        const v = getValue<string | null>()
        return v ? (
          <span className="font-mono text-sm">{fmtTime(v)}</span>
        ) : (
          <span className="text-xs italic text-neutral-400">—</span>
        )
      },
    },
    {
      accessorKey: 'duration_minutes',
      header: 'Duration',
      cell: ({ getValue }) => {
        const mins = getValue<number | null>()
        return mins != null ? (
          <span className="text-sm font-medium">{formatDuration(mins)}</span>
        ) : (
          <span className="text-xs italic text-neutral-400">—</span>
        )
      },
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          reason={row.original.closed_reason}
          autoClosed={row.original.auto_closed}
        />
      ),
    },
    ...adminCol,
  ]

  return (
    <>
      <DataTable
        data={rows}
        columns={columns}
        searchPlaceholder="Search sessions…"
        emptyMessage="No time sessions recorded."
      />

      {isAdmin && (
        <TimeLogEditDialog
          open={!!editing}
          log={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
            setEditing(null)
          }}
        />
      )}
    </>
  )
}
