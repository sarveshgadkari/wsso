'use client'

import { useState, useEffect, useTransition } from 'react'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { getProjectProgressReport } from '@/lib/actions/reports'
import { downloadCSV } from './report-utils'
import type { ProjectProgressRow } from './report-types'

const STATUS_LABEL: Record<string, string> = {
  active:    'Active',
  on_hold:   'On Hold',
  completed: 'Completed',
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning'> = {
  active:    'default',
  on_hold:   'warning',
  completed: 'success',
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200">
        <div
          className="h-full rounded-full bg-primary-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs tabular-nums text-neutral-600">{pct}%</span>
    </div>
  )
}

export function ProjectProgressReport() {
  const [statusFilter, setStatusFilter] = useState('all')
  const [rows, setRows]                 = useState<ProjectProgressRow[]>([])
  const [isPending, start]              = useTransition()

  useEffect(() => {
    start(async () => {
      const data = await getProjectProgressReport(statusFilter === 'all' ? undefined : statusFilter)
      setRows(data)
    })
  }, [statusFilter])

  function exportCSV() {
    downloadCSV(
      `project-progress.csv`,
      ['Code', 'Project', 'Status', 'Total Tasks', 'Done', '% Complete', 'Est. Hours', 'Logged Hours'],
      rows.map(r => [
        r.code, r.name, STATUS_LABEL[r.status] ?? r.status,
        r.total_tactics, r.done_tactics, r.pct_complete,
        r.estimated_hours, r.logged_hours,
      ]),
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Status</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="h-9 rounded border border-neutral-300 bg-white pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="on_hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
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
          Project Progress Report
          {statusFilter !== 'all' ? ` — ${STATUS_LABEL[statusFilter] ?? statusFilter}` : ''}
        </p>
      </div>

      <div className="card overflow-hidden">
        {isPending ? (
          <div className="flex h-40 items-center justify-center text-sm text-neutral-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Project</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Tasks</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Done</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Progress</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Est. hrs</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Logged hrs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-neutral-800">{r.name}</p>
                    <p className="font-mono text-xs text-neutral-400">{r.code}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.total_tactics}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-success-700 font-medium">{r.done_tactics}</td>
                  <td className="px-4 py-3">
                    <ProgressBar pct={r.pct_complete} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                    {r.estimated_hours > 0 ? `${r.estimated_hours}h` : <span className="text-neutral-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.logged_hours > 0 ? (
                      <span className={r.estimated_hours > 0 && r.logged_hours > r.estimated_hours ? 'font-bold text-warning-700' : ''}>
                        {r.logged_hours}h
                      </span>
                    ) : (
                      <span className="text-neutral-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-neutral-400">
                    No projects found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
