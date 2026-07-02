'use client'

import { useState, useEffect, useTransition } from 'react'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getDailyTimeReport } from '@/lib/actions/reports'
import { downloadCSV, fmtHours, fmtDecimalHours, isoToday, fmtDate } from './report-utils'
import type { DailyTimeRow } from './report-types'

interface Props {
  viewerTimezone: string
}

export function DailyTimeReport({ viewerTimezone }: Props) {
  const [date, setDate]       = useState(() => isoToday(viewerTimezone))
  const [rows, setRows]       = useState<DailyTimeRow[]>([])
  const [isPending, start]    = useTransition()

  useEffect(() => {
    start(async () => {
      const data = await getDailyTimeReport(date)
      setRows(data)
    })
  }, [date])

  const total = rows.reduce((s, r) => s + r.minutes, 0)
  const maxDate = isoToday(viewerTimezone)

  function exportCSV() {
    downloadCSV(
      `daily-time-${date}.csv`,
      ['Employee', 'Code', 'Timezone', 'Date', 'Hours (decimal)', 'Hours (h:m)'],
      rows.map(r => [r.full_name, r.employee_code, r.timezone, date, fmtDecimalHours(r.minutes), fmtHours(r.minutes)]),
    )
  }

  return (
    <div>
      {/* Controls — hidden when printing */}
      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Date</label>
          <input
            type="date"
            value={date}
            max={maxDate}
            onChange={e => setDate(e.target.value)}
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

      {/* Print header — only visible when printing */}
      <div className="hidden print:block print:mb-4">
        <p className="text-xs text-neutral-500">Daily Time Report — {fmtDate(date)}</p>
      </div>

      <div className="card overflow-hidden">
        {isPending ? (
          <div className="flex h-40 items-center justify-center text-sm text-neutral-400">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Timezone</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Hours</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Hours (decimal)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map(r => (
                <tr key={r.id} className={r.minutes === 0 ? 'text-neutral-400' : ''}>
                  <td className="px-5 py-3 font-medium">{r.full_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.employee_code}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{r.timezone}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.minutes > 0 ? fmtHours(r.minutes) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.minutes > 0 ? fmtDecimalHours(r.minutes) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
                <td className="px-5 py-3">Total</td>
                <td />
                <td />
                <td className="px-4 py-3 text-right tabular-nums">{fmtHours(total)}</td>
                <td className="px-4 py-3 text-right tabular-nums">{fmtDecimalHours(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {!isPending && (
        <p className="mt-2 text-right text-xs text-neutral-400">
          {rows.filter(r => r.minutes > 0).length} of {rows.length} employees logged time
          on their local {fmtDate(date)}.
        </p>
      )}
    </div>
  )
}
