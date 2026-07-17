'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, StickyNote } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { reviewClockNote } from '@/lib/actions/time'

export interface PendingNoteRow {
  timeLogId:    string
  employeeName: string
  employeeCode: string
  logDate:      string
  field:        'clock_in' | 'clock_out'
  note:         string
}

interface Props {
  notes: PendingNoteRow[]
}

export function PendingNotesPanel({ notes }: Props) {
  const router = useRouter()
  const [isPending, start] = useTransition()

  if (notes.length === 0) return null

  function handleReview(timeLogId: string, field: 'clock_in' | 'clock_out', decision: 'approved' | 'rejected') {
    start(async () => {
      const res = await reviewClockNote(timeLogId, field, decision)
      if (!res.error) router.refresh()
    })
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-3">
        <StickyNote className="h-4 w-4 text-primary-500" />
        <h3 className="text-sm font-semibold text-neutral-700">Pending clock-in/out notes</h3>
        <span className="ml-auto rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
          {notes.length}
        </span>
      </div>
      <ul className="divide-y divide-neutral-100">
        {notes.map((n) => (
          <li key={`${n.timeLogId}-${n.field}`} className="flex items-start justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-800">
                {n.employeeName}
                <span className="ml-1.5 font-mono text-[11px] font-normal text-neutral-400">{n.employeeCode}</span>
              </p>
              <p className="text-xs text-neutral-400">
                {n.field === 'clock_in' ? 'Clock-in note' : 'Clock-out note'} · {n.logDate}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600">{n.note}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={isPending}
                onClick={() => handleReview(n.timeLogId, n.field, 'rejected')}
              >
                <X className="h-3.5 w-3.5" />
                Reject
              </Button>
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => handleReview(n.timeLogId, n.field, 'approved')}
              >
                <Check className="h-3.5 w-3.5" />
                Approve
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
