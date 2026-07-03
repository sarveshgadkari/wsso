'use client'

import { useState, useEffect } from 'react'
import { Play, Square, Timer, CheckCircle2 } from 'lucide-react'
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
}

export function ClockWidgetUI({ session, timeZone, dayComplete, canClockIn }: Props) {
  const toast = useToast()
  const [activeSession, setActiveSession] = useState<TimeLog | null>(
    session && !session.clock_out_at ? session : null,
  )
  const [elapsed, setElapsed] = useState(0)
  const [busy,    setBusy]    = useState(false)

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
    const res = await clockIn()
    setBusy(false)
    if (res.error) { toast.error(res.error); return }
    setActiveSession(res.data ?? null)
    toast.success('Clocked in — have a productive day!')
  }

  const handleClockOut = async () => {
    setBusy(true)
    const res = await clockOut()
    setBusy(false)
    if (res.error) { toast.error(res.error); return }
    setActiveSession(null)
    toast.success('Clocked out. Good work!')
  }

  const active = !!activeSession
  const tzLabel = timezoneShortLabel(timeZone)

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
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-6">
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
    </div>
  )
}
