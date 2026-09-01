'use client'

import { useState, useTransition } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getPayrollExport } from '@/lib/actions/ops'
import { useToast } from '@/lib/store/toast'

function csvEscape(v: string | number) {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function PayrollExportButton({ defaultFrom, defaultTo }: { defaultFrom: string; defaultTo: string }) {
  const toast = useToast()
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [pending, start] = useTransition()

  function download() {
    start(async () => {
      const rows = await getPayrollExport(from, to)
      if (rows.length === 0) {
        toast.error('No hours in that range')
        return
      }
      const header = [
        'employee_code', 'full_name', 'week_start', 'week_end',
        'hours', 'overtime_hours', 'hourly_rate', 'regular_pay', 'overtime_pay', 'total_pay',
      ]
      const body = rows.map((r) => [
        r.employee_code,
        r.full_name,
        r.week_start,
        r.week_end,
        (r.minutes / 60).toFixed(2),
        (r.overtime_minutes / 60).toFixed(2),
        (r.hourly_rate_cents / 100).toFixed(2),
        (r.regular_pay_cents / 100).toFixed(2),
        (r.overtime_pay_cents / 100).toFixed(2),
        ((r.regular_pay_cents + r.overtime_pay_cents) / 100).toFixed(2),
      ].map(csvEscape).join(','))
      const blob = new Blob([[header.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `payroll-${from}-to-${to}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${rows.length} week row(s)`)
    })
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        From
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded border border-neutral-300 px-2 text-sm" />
      </label>
      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        To
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded border border-neutral-300 px-2 text-sm" />
      </label>
      <Button variant="secondary" onClick={download} loading={pending}>
        <Download className="h-4 w-4" /> Payroll CSV
      </Button>
    </div>
  )
}
