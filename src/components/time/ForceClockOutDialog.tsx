'use client'

import { useState, useEffect } from 'react'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { forceClockOut } from '@/lib/actions/time'

interface Props {
  open:       boolean
  employeeId: string
  timeLogId:  string
  clockInAt:  string
  onClose:    () => void
}

function nowDatetimeLocal(): string {
  const d   = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ForceClockOutDialog({ open, employeeId, timeLogId, clockInAt, onClose }: Props) {
  const router = useRouter()
  const [clockOutAt, setClockOutAt] = useState(nowDatetimeLocal)
  const [error,      setError]      = useState<string | null>(null)
  const [busy,       setBusy]       = useState(false)

  // Reset to current time and clear error each time dialog opens
  useEffect(() => {
    if (open) {
      setClockOutAt(nowDatetimeLocal())
      setError(null)
    }
  }, [open])

  const handleSubmit = async () => {
    setBusy(true)
    setError(null)
    const res = await forceClockOut(timeLogId, new Date(clockOutAt).toISOString(), employeeId)
    setBusy(false)
    if (res.error) { setError(res.error); return }
    onClose()
    router.refresh()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Force clock out"
      description="Close this open session on behalf of the employee. This action is logged."
      size="sm"
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-md bg-neutral-50 px-4 py-3 text-sm text-neutral-600">
          <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-neutral-400">
            Clocked in at
          </p>
          <p className="font-mono">
            {new Date(clockInAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">
            Clock-out time <span className="text-danger-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={clockOutAt}
            onChange={(e) => setClockOutAt(e.target.value)}
            className="h-9 w-full rounded border border-neutral-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {error && (
          <div className="rounded-md border border-danger-500/30 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {error}
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="primary" loading={busy} onClick={handleSubmit}>
          <LogOut className="h-3.5 w-3.5" />
          Force clock out
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
