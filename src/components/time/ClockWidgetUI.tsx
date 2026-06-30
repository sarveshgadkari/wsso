'use client'

import { useState, useEffect } from 'react'
import { Play, Square, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { clockIn, clockOut } from '@/lib/actions/time'
import { useToast } from '@/lib/store/toast'
import type { TimeLog } from '@/lib/types'

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

interface Props {
  initialSession: TimeLog | null
}

export function ClockWidgetUI({ initialSession }: Props) {
  const toast = useToast()
  const [session, setSession] = useState<TimeLog | null>(initialSession)
  const [elapsed, setElapsed] = useState(0)
  const [busy,    setBusy]    = useState(false)

  // Resume the timer from clock_in_at whenever a session exists
  useEffect(() => {
    if (!session) { setElapsed(0); return }

    const startMs = new Date(session.clock_in_at).getTime()
    setElapsed(Math.floor((Date.now() - startMs) / 1000))

    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - startMs) / 1000)),
      1000,
    )
    return () => clearInterval(id)
  }, [session])

  const handleClockIn = async () => {
    setBusy(true)
    const res = await clockIn()
    setBusy(false)
    if (res.error) { toast.error(res.error); return }
    setSession(res.data ?? null)
    toast.success('Clocked in — have a productive day!')
  }

  const handleClockOut = async () => {
    setBusy(true)
    const res = await clockOut()
    setBusy(false)
    if (res.error) { toast.error(res.error); return }
    setSession(null)
    toast.success('Clocked out. Good work!')
  }

  const active = !!session

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between gap-4">
        {/* Left: icon + label + timer */}
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
              <p className="font-mono text-3xl font-bold tracking-widest text-neutral-900 tabular-nums">
                {formatElapsed(elapsed)}
              </p>
            ) : (
              <p className="text-xs text-neutral-400">
                Clock in when you start working to track your time
              </p>
            )}
          </div>
        </div>

        {/* Right: action button */}
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
        ) : (
          <Button
            size="lg"
            loading={busy}
            onClick={handleClockIn}
            className="shrink-0"
          >
            <Play className="h-4 w-4 fill-current" />
            Clock In
          </Button>
        )}
      </div>
    </div>
  )
}
