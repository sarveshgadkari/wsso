'use client'

import { useState, useEffect, useTransition } from 'react'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getWeeklyTimeReport } from '@/lib/actions/reports'
import {
  downloadCSV, fmtHours, fmtDecimalHours,
  isoToday, toMonday, weekLabel,
} from './report-utils'
import type { WeeklyTimeRow } from './report-types'

// ── Tiny inline sparkline (7-bar SVG) ─────────────────────────────────────────

function Sparkline({ days, dates }: { days: Record<string, number>; dates: string[] }) {
  const max = Math.max(...dates.map(d => days[d] ?? 0), 1)
  const H = 22
  const W = 9
  return (
    <svg width={dates.length * W} height={H} className="shrink-0">
      {dates.map((d, i) => {
        const mins = days[d] ?? 0
        const barH = Math.max(2, Math.round((mins / max) * (H - 2)))
        return (
          <rect
            key={d}
            x={i * W}
            y={H - barH}
            width={W - 2}
            height={barH}
            rx="1"
            fill={mins > 0 ? '#93c5fd' : '#e2e8f0'}
          />
        )
      })}
    </svg>
  )
}

export function WeeklyTimeReport() {
  const thisMonday = toMonday(isoToday())
  const [weekInput, setWeekInput] = useState(thisMonday)
  const [rows,      setRows]      = useState<WeeklyTimeRow[]>([])
  const [dates,     setDates]     = useState<string[]>([])
  const [weekStart, setWeekStart] = useState(thisMonday)
  const [isPending, start]        = useTransition()

  useEffect(() => {
    start(async () => {
      const result = await getWeeklyTimeReport(weekInput)
      setRows(result.rows)
      setDates(result.weekDates)
      setWeekStart(result.weekStart)
    })
  }, [weekInput])

  const totals = dates.reduce<Record<string, number>>((acc, d) => {
    acc[d] = rows.reduce((s, r) => s + (r.days[d] ?? 0), 0)
    return acc
  }, {})
  const grandTotal = rows.reduce((s, r) => s + r.total, 0)

  function exportCSV() {
    const dayLabels = dates.map(d =>
      new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    )
    downloadCSV(
      `weekly-time-${weekStart}.csv`,
      ['Employee', 'Code', ...dayLabels, 'Total (h)', 'Total (decimal)'],
      rows.map(r => [
        r.full_name, r.employee_code,
        ...dates.map(d => fmtDecimalHours(r.days[d] ?? 0)),
        fmtHours(r.total),
        fmtDecimalHours(r.total),
      ]),
    )
  }

  const shortDay = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
  const shortDate = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Any date in the week
          </label>
          <input
            type="date"
            value={weekInput}
            max={isoToday()}
            onChange={e => setWeekInput(e.target.value)}
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
        <p className="text-xs text-neutral-500">Weekly Time Report — {weekLabel(weekStart)}</p>
      </div>

      {dates.length > 0 && !isPending && (
        <p className="mb-3 text-sm text-neutral-500">{weekLabel(weekStart)}</p>
      )}

      <div className="card overflow-x-auto">
        {isPending ? (
          <div className="flex h-40 items-center justify-center text-sm text-neutral-400">Loading…</div>
        ) : (
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Employee</th>
                {dates.map(d => (
                  <th key={d} className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    <div>{shortDay(d)}</div>
                    <div className="font-normal normal-case text-neutral-300">{shortDate(d)}</div>
                  </th>
                ))}
                <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Total</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-400 print:hidden">
                  Trend
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map(r => (
                <tr key={r.id} className={r.total === 0 ? 'text-neutral-400' : ''}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{r.full_name}</p>
                    <p className="font-mono text-xs text-neutral-400">{r.employee_code}</p>
                  </td>
                  {dates.map(d => (
                    <td key={d} className="px-3 py-3 text-center tabular-nums text-xs">
                      {(r.days[d] ?? 0) > 0 ? fmtDecimalHours(r.days[d]) : <span className="text-neutral-300">—</span>}
                    </td>
                  ))}
                  <td className="px-3 py-3 text-right tabular-nums font-medium">
                    {r.total > 0 ? fmtHours(r.total) : '—'}
                  </td>
                  <td className="px-4 py-3 print:hidden">
                    <Sparkline days={r.days} dates={dates} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-neutral-300 bg-neutral-50 font-semibold">
                <td className="px-5 py-3">Total</td>
                {dates.map(d => (
                  <td key={d} className="px-3 py-3 text-center tabular-nums text-xs">
                    {totals[d] > 0 ? fmtDecimalHours(totals[d]) : '—'}
                  </td>
                ))}
                <td className="px-3 py-3 text-right tabular-nums">{fmtHours(grandTotal)}</td>
                <td className="print:hidden" />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
