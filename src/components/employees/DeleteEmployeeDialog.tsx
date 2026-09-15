'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { deleteEmployeeProfile } from '@/lib/actions/employees'

interface Props {
  open: boolean
  employeeId: string
  fullName: string
  onClose: () => void
  onDeleted: () => void
}

export function DeleteEmployeeDialog({ open, employeeId, fullName, onClose, onDeleted }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onConfirm = async () => {
    setBusy(true)
    setError(null)
    const res = await deleteEmployeeProfile(employeeId)
    setBusy(false)
    if (res.error) {
      setError(res.error)
      return
    }
    onDeleted()
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!busy) {
          setError(null)
          onClose()
        }
      }}
      title="Delete profile?"
      size="sm"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-2 rounded-md border border-danger-500/30 bg-danger-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-500" />
          <p className="text-sm text-danger-700">
            This permanently deletes <strong>{fullName}</strong> and they will not be able to sign in.
            Time logs and work tied to them stay in the workspace where possible.
            This cannot be undone.
          </p>
        </div>
        {error && (
          <p className="text-sm text-danger-700">{error}</p>
        )}
      </div>

      <DialogFooter>
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button variant="destructive" loading={busy} onClick={() => void onConfirm()}>
          Delete profile
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
