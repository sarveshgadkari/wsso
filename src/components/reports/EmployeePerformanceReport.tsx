'use client'

import { useState, useEffect, useTransition } from 'react'
import { Download, Printer, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getEmployeePerformanceReport } from '@/lib/actions/reports'
import { downloadCSV, isoToday, isoDaysAgo, fmtDate } from './report-utils'
import type { PerformanceRow } from './report-types'

interface Props {
  viewerTimezone: string
}

export function EmployeePerformanceReport({ viewerTimezone }: Props) {
  const [from, setFrom]     = useState(() => isoDaysAgo(30, viewerTimezone))
  const [to,   setTo]       = useState(() => isoToday(viewerTimezone))
  const maxDate             = isoToday(viewerTimezone)
  const [rows, setRows]     = useState<PerformanceRow[]>([])
  const [isPending, start]  = useTransition()

  useEffect(() => {
    start(async () => {
      const data = await getEmployeePerformanceReport(from, to)
      setRows(data)
    })
  }, [from, to])

  function exportCSV() {
    downloadCSV(
      `performance-${from}-${to}.csv`,
      ['Employee', 'Code', 'Timezone', 'Assigned (active)', 'Completed in range', 'Overdue', 'Avg completion (days)', 'Clock hours in range'],
      rows.map(r => [
        r.full_name, r.employee_code, r.timezone,
        r.assigned, r.completed, r.overdue,
        r.avg_completion_days ?? '—',
        r.clock_hours,
      ]),
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">From</label>
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
            max={maxDate}
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
        <p className="text-xs text-neutral-500">Employee Performance — {fmtDate(from)} to {fmtDate(to)}</p>
      </div>

      <div className="card overflow-hidden">
        {isPending ? (
          <div className="flex h-40 items-center justify-center text-sm text-neutral-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Timezone</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Assigned</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Completed</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Overdue</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Avg completion</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Clock hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-neutral-50">
                  <td className="px-5 py-3">
                    <p className="font-medium text-neutral-800">{r.full_name}</p>
                    <p className="font-mono text-xs text-neutral-400">{r.employee_code}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{r.timezone}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.assigned}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-medium text-success-700">{r.completed}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.overdue > 0 ? (
                      <span className="inline-flex items-center gap-1 font-bold text-danger-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {r.overdue}
                      </span>
                    ) : (
                      <span className="text-neutral-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-600">
                    {r.avg_completion_days != null ? `${r.avg_completion_days}d` : <span className="text-neutral-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.clock_hours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!isPending && (
        <p className="mt-2 text-right text-xs text-neutral-400">
          Completed count and avg completion are for tasks marked done between {fmtDate(from)} and {fmtDate(to)}.
          Overdue reflects current state. Assigned = all active (non-archived) work orders.
        </p>
      )}
    </div>
  )
}
