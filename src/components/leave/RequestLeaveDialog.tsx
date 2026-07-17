'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { requestLeave } from '@/lib/actions/leave'

interface Props {
  open:    boolean
  onClose: () => void
}

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function RequestLeaveDialog({ open, onClose }: Props) {
  const router = useRouter()
  const [startDate, setStartDate] = useState(todayISO())
  const [endDate,   setEndDate]   = useState(todayISO())
  const [halfDay,   setHalfDay]   = useState(false)
  const [halfDayPeriod, setHalfDayPeriod] = useState<'morning' | 'afternoon'>('morning')
  const [reason,    setReason]    = useState('')
  const [error,     setError]     = useState('')
  const [busy,      setBusy]      = useState(false)

  const isSingleDay = startDate === endDate

  function reset() {
    setStartDate(todayISO())
    setEndDate(todayISO())
    setHalfDay(false)
    setHalfDayPeriod('morning')
    setReason('')
    setError('')
  }

  async function handleSubmit() {
    if (!reason.trim()) { setError('Reason is required'); return }
    setBusy(true)
    setError('')
    const res = await requestLeave({
      start_date:      startDate,
      end_date:        endDate,
      half_day:        halfDay && isSingleDay,
      half_day_period: halfDay && isSingleDay ? halfDayPeriod : null,
      reason:          reason.trim(),
    })
    setBusy(false)
    if (res.error) { setError(res.error); return }
    reset()
    onClose()
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onClose={() => { reset(); onClose() }}
      title="Request leave"
      description="Sent to your manager (or admin) for approval."
      size="sm"
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value)
                if (e.target.value > endDate) setEndDate(e.target.value)
              }}
              className="h-9 w-full rounded border border-neutral-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-neutral-700">End date</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-full rounded border border-neutral-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>

        {isSingleDay && (
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={halfDay}
              onChange={(e) => setHalfDay(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            Half day
          </label>
        )}

        {halfDay && isSingleDay && (
          <select
            value={halfDayPeriod}
            onChange={(e) => setHalfDayPeriod(e.target.value as 'morning' | 'afternoon')}
            className="h-9 w-full rounded border border-neutral-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
          </select>
        )}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">
            Reason <span className="text-danger-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Why are you requesting this leave?"
            className="w-full resize-none rounded border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {error && <p className="text-sm text-danger-600">{error}</p>}
      </div>

      <DialogFooter>
        <Button variant="secondary" type="button" onClick={() => { reset(); onClose() }} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} loading={busy}>
          Submit request
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
