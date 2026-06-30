'use client'

import { useState, useEffect, useTransition } from 'react'
import { Download, Printer, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { getWorkOrdersReport, getProjectOptions } from '@/lib/actions/reports'
import { downloadCSV, isoToday, isoDaysAgo } from './report-utils'
import {
  STATUS_LABEL, STATUS_VARIANT, PRIORITY_LABEL, PRIORITY_VARIANT,
} from '@/lib/tactics-utils'
import type { WorkOrderRow } from './report-types'
import type { TacticStatus } from '@/lib/types'

const STATUS_GROUPS: TacticStatus[] = ['in_progress', 'assigned', 'review', 'done', 'archived']

const FILTER_OPTIONS = [
  { value: 'all',      label: 'All' },
  { value: 'open',     label: 'Open (Assigned + In Progress)' },
  { value: 'review',   label: 'In Review' },
  { value: 'overdue',  label: 'Overdue' },
  { value: 'done',     label: 'Completed' },
  { value: 'archived', label: 'Archived' },
]

interface ProjectOption { id: string; name: string; code: string }

export function WorkOrdersReport() {
  const [status,    setStatus]    = useState('open')
  const [projectId, setProjectId] = useState('')
  const [from,      setFrom]      = useState(() => isoDaysAgo(30))
  const [to,        setTo]        = useState(isoToday)
  const [rows,      setRows]      = useState<WorkOrderRow[]>([])
  const [projects,  setProjects]  = useState<ProjectOption[]>([])
  const [isPending, start]        = useTransition()

  // Load project options once
  useEffect(() => {
    getProjectOptions().then(setProjects)
  }, [])

  useEffect(() => {
    start(async () => {
      const data = await getWorkOrdersReport({
        status:     status     || undefined,
        project_id: projectId  || undefined,
        from:       from       || undefined,
        to:         to         || undefined,
      })
      setRows(data)
    })
  }, [status, projectId, from, to])

  // Group rows by status for 'all' view, flat otherwise
  const grouped: { label: string; variant: string; items: WorkOrderRow[] }[] =
    status === 'all' || status === 'overdue'
      ? STATUS_GROUPS.flatMap(s => {
          const items = status === 'overdue'
            ? rows  // already filtered server-side
            : rows.filter(r => r.status === s)
          return items.length ? [{ label: STATUS_LABEL[s], variant: STATUS_VARIANT[s], items }] : []
        })
      : [{ label: FILTER_OPTIONS.find(o => o.value === status)?.label ?? status, variant: 'default', items: rows }]

  function exportCSV() {
    downloadCSV(
      `work-orders-${status}.csv`,
      ['Code', 'Title', 'Status', 'Priority', 'Assigned To', 'Project', 'Due Date', 'Est. Hours', 'Created'],
      rows.map(r => [
        r.code, r.title,
        STATUS_LABEL[r.status], PRIORITY_LABEL[r.priority],
        r.assignee_name, r.project_name ?? '',
        r.due_date ?? '', r.estimated_hours ?? '',
        r.created_at.split('T')[0],
      ]),
    )
  }

  const today = isoToday()

  function dueCls(row: WorkOrderRow): string {
    if (!row.due_date || row.status === 'done' || row.status === 'archived') return 'text-neutral-500'
    if (row.due_date < today) return 'font-bold text-danger-600'
    if (row.due_date === today) return 'font-bold text-warning-600'
    return 'text-neutral-500'
  }

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</label>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="h-9 rounded border border-neutral-300 bg-white pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {projects.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Project</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="h-9 rounded border border-neutral-300 bg-white pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">All projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Created from</label>
          <input
            type="date"
            value={from}
            max={to}
            onChange={e => setFrom(e.target.value)}
            className="h-9 rounded border border-neutral-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">To</label>
          <input
            type="date"
            value={to}
            min={from}
            max={isoToday()}
            onChange={e => setTo(e.target.value)}
            className="h-9 rounded border border-neutral-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <Button variant="secondary" size="sm" onClick={exportCSV} disabled={isPending}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5" /> Print / PDF
        </Button>
      </div>

      <div className="hidden print:block print:mb-4">
        <p className="text-xs text-neutral-500">
          Work Orders — {FILTER_OPTIONS.find(o => o.value === status)?.label ?? status}
        </p>
      </div>

      {isPending ? (
        <div className="card flex h-40 items-center justify-center text-sm text-neutral-400">Loading…</div>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(group => (
            <div key={group.label} className="card overflow-hidden">
              <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-5 py-2.5">
                <Badge variant={group.variant as 'default' | 'success' | 'warning' | 'danger' | 'info'}>
                  {group.label}
                </Badge>
                <span className="ml-1 text-xs text-neutral-400">{group.items.length} tasks</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100">
                    <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Code</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Title</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Priority</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Assigned To</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Project</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Due Date</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Est. hrs</th>
                    <th className="w-8 px-4 py-2.5 print:hidden" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {group.items.map(r => (
                    <tr key={r.id} className="hover:bg-neutral-50">
                      <td className="px-5 py-2.5 font-mono text-xs text-neutral-500">{r.code}</td>
                      <td className="max-w-[260px] px-4 py-2.5">
                        <p className="truncate font-medium text-neutral-800">{r.title}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={PRIORITY_VARIANT[r.priority]}>{PRIORITY_LABEL[r.priority]}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-neutral-600">{r.assignee_name}</td>
                      <td className="px-4 py-2.5 text-neutral-500">{r.project_name ?? <span className="text-neutral-300">—</span>}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums text-xs ${dueCls(r)}`}>
                        {r.due_date ?? <span className="text-neutral-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs text-neutral-500">
                        {r.estimated_hours ?? <span className="text-neutral-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 print:hidden">
                        <Link href={`/tactics/${r.id}`} className="text-primary-600 hover:text-primary-800">
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          {rows.length === 0 && (
            <div className="card flex h-40 items-center justify-center text-sm text-neutral-400">
              No work orders match the selected filters
            </div>
          )}
        </div>
      )}

      {!isPending && rows.length > 0 && (
        <p className="mt-2 text-right text-xs text-neutral-400">{rows.length} total work orders</p>
      )}
    </div>
  )
}
