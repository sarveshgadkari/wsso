'use client'

import { useState, useEffect } from 'react'
import { Play, Square, Timer, CheckCircle2, StickyNote, CalendarOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { clockIn, clockOut } from '@/lib/actions/time'
import { useToast } from '@/lib/store/toast'
import { formatTimeInTimezone, timezoneShortLabel } from '@/lib/utils/timezones'
import type { TimeLog } from '@/lib/types'

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

interface Props {
  session:      TimeLog | null
  timeZone:     string
  dayComplete:  boolean
  canClockIn:   boolean
  onLeave:      boolean
  halfDayLeave: 'morning' | 'afternoon' | null
}

export function ClockWidgetUI({ session, timeZone, dayComplete, canClockIn, onLeave, halfDayLeave }: Props) {
  const toast = useToast()
  const [activeSession, setActiveSession] = useState<TimeLog | null>(
    session && !session.clock_out_at ? session : null,
  )
  const [elapsed, setElapsed] = useState(0)
  const [busy,    setBusy]    = useState(false)
  const [showNote, setShowNote] = useState(false)
  const [note,     setNote]     = useState('')

  useEffect(() => {
    setActiveSession(session && !session.clock_out_at ? session : null)
  }, [session])

  useEffect(() => {
    if (!activeSession) { setElapsed(0); return }

    const startMs = new Date(activeSession.clock_in_at).getTime()
    setElapsed(Math.floor((Date.now() - startMs) / 1000))

    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startMs) / 1000)),
      1000,
    )
    return () => clearInterval(id)
  }, [activeSession])

  const handleClockIn = async () => {
    setBusy(true)
    const res = await clockIn(note)
    setBusy(false)
    if (res.error) { toast.error(res.error); return }
    setActiveSession(res.data ?? null)
    setShowNote(false)
    setNote('')
    toast.success('Clocked in — have a productive day!')
  }

  const handleClockOut = async () => {
    setBusy(true)
    const res = await clockOut(note)
    setBusy(false)
    if (res.error) { toast.error(res.error); return }
    setActiveSession(null)
    setShowNote(false)
    setNote('')
    toast.success('Clocked out. Good work!')
  }

  const active = !!activeSession
  const tzLabel = timezoneShortLabel(timeZone)

  const halfDayBanner = halfDayLeave && (
    <div className="mb-3 flex items-center gap-2 rounded-md border border-primary-200 bg-primary-50 px-3 py-2 text-xs text-primary-700">
      <CalendarOff className="h-3.5 w-3.5 shrink-0" />
      Approved half-day leave today ({halfDayLeave === 'morning' ? 'morning' : 'afternoon'}).
    </div>
  )

  if (onLeave && !session) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-50">
            <CalendarOff className="h-6 w-6 text-primary-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-primary-700">On leave today</p>
            <p className="text-xs text-neutral-400">
              Your leave request for today is approved — no clock-in expected.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (dayComplete && session) {
    return (
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success-100">
            <CheckCircle2 className="h-6 w-6 text-success-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-success-700">Today&apos;s shift complete</p>
            <p className="text-xs text-neutral-500">
              {formatTimeInTimezone(timeZone, new Date(session.clock_in_at))}
              {' – '}
              {session.clock_out_at
                ? formatTimeInTimezone(timeZone, new Date(session.clock_out_at))
                : '—'}
              {' '}({tzLabel})
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              One session per day — you can clock in again tomorrow in your timezone.
            </p>
            {(session.clock_in_note || session.clock_out_note) && (
              <p className="mt-1 text-xs text-neutral-400">
                Note submitted — awaiting or reviewed by your manager/admin.
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
      {halfDayBanner}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors',
              active ? 'bg-success-100' : 'bg-neutral-100',
            )}
          >
            <Timer
              className={cn(
                'h-6 w-6 transition-colors',
                active ? 'text-success-600' : 'text-neutral-400',
              )}
            />
          </div>

          <div>
            <p className={cn('text-sm font-medium', active ? 'text-success-700' : 'text-neutral-500')}>
              {active ? 'Currently clocked in' : 'Not clocked in'}
            </p>
            {active ? (
              <>
                <p className="font-mono text-3xl font-bold tracking-widest text-neutral-900 tabular-nums">
                  {formatElapsed(elapsed)}
                </p>
                <p className="text-xs text-neutral-400">
                  Since {formatTimeInTimezone(timeZone, new Date(activeSession!.clock_in_at))} {tzLabel}
                </p>
              </>
            ) : (
              <p className="text-xs text-neutral-400">
                Click Clock In when you start work ({tzLabel}). One session per day.
              </p>
            )}
          </div>
        </div>

        {active ? (
          <Button
            variant="destructive"
            size="lg"
            loading={busy}
            onClick={handleClockOut}
            className="shrink-0"
          >
            <Square className="h-4 w-4 fill-current" />
            Clock Out
          </Button>
        ) : canClockIn ? (
          <Button
            size="lg"
            loading={busy}
            onClick={handleClockIn}
            className="shrink-0"
          >
            <Play className="h-4 w-4 fill-current" />
            Clock In
          </Button>
        ) : null}
      </div>

      {(active || canClockIn) && (
        <div className="mt-4 border-t border-neutral-100 pt-3">
          {showNote ? (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-neutral-600">
                Note {active ? '(e.g. leaving early — reason)' : '(e.g. clocking in late — reason)'}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                placeholder="Add context for your manager/admin to review…"
                className="w-full resize-none rounded border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => { setShowNote(false); setNote('') }}
                className="self-start text-xs text-neutral-400 hover:text-neutral-600"
              >
                Cancel note
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNote(true)}
              className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-primary-600"
            >
              <StickyNote className="h-3.5 w-3.5" />
              Add a note {active ? '(clocking out early?)' : '(clocking in late?)'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
