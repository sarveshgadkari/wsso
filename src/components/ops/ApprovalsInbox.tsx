'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { reviewLeaveRequest } from '@/lib/actions/leave'
import { reviewClockNote } from '@/lib/actions/time'

type LeaveRow = {
  id: string
  start_date: string
  end_date: string
  half_day: boolean
  half_day_period: string | null
  reason: string
  leave_type_id: string | null
  employee: { id: string; full_name: string; employee_code: string }
}

type NoteRow = {
  timeLogId: string
  employeeName: string
  employeeCode: string
  logDate: string
  field: 'clock_in' | 'clock_out'
  note: string
}

export function ApprovalsInbox({
  leave,
  notes,
  leaveTypeLabel,
}: {
  leave: LeaveRow[]
  notes: NoteRow[]
  leaveTypeLabel: Record<string, string>
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="card">
        <div className="border-b border-neutral-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-neutral-800">Pending leave ({leave.length})</h3>
        </div>
        {leave.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-400">No leave waiting.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {leave.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-800">{r.employee.full_name}</p>
                  <p className="text-xs text-neutral-500">
                    {r.start_date === r.end_date ? r.start_date : `${r.start_date} → ${r.end_date}`}
                    {r.leave_type_id && leaveTypeLabel[r.leave_type_id] ? ` · ${leaveTypeLabel[r.leave_type_id]}` : ''}
                    {r.half_day ? ` · half ${r.half_day_period}` : ''}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">{r.reason}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => start(async () => { await reviewLeaveRequest(r.id, 'approved'); router.refresh() })}
                  >
                    <Check className="h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => start(async () => { await reviewLeaveRequest(r.id, 'rejected'); router.refresh() })}
                  >
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <div className="border-b border-neutral-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-neutral-800">Clock notes ({notes.length})</h3>
        </div>
        {notes.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-neutral-400">No notes to review.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {notes.map((n) => (
              <li key={`${n.timeLogId}-${n.field}`} className="flex items-start justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-neutral-800">{n.employeeName}</p>
                  <p className="text-xs text-neutral-500">
                    {n.logDate} · {n.field === 'clock_in' ? 'Clock in' : 'Clock out'}
                  </p>
                  <p className="mt-1 text-sm text-neutral-600">{n.note}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    disabled={pending}
                    onClick={() => start(async () => { await reviewClockNote(n.timeLogId, n.field, 'approved'); router.refresh() })}
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => start(async () => { await reviewClockNote(n.timeLogId, n.field, 'rejected'); router.refresh() })}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
