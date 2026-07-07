'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { requestRevision } from '@/lib/actions/tactic-documents'

interface Props {
  open:    boolean
  docId:   string
  docCode: string
  onClose: () => void
}

export function RevisionModal({ open, docId, docCode, onClose }: Props) {
  const router = useRouter()
  const [note,     setNote]    = useState('')
  const [error,    setError]   = useState('')
  const [isPending, start]     = useTransition()

  function handleClose() {
    setNote('')
    setError('')
    onClose()
  }

  function handleSubmit() {
    if (!note.trim()) {
      setError('Please provide a reason for requesting revision.')
      return
    }
    setError('')
    start(async () => {
      try {
        await requestRevision(docId, note.trim())
        handleClose()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={`Request Revision — ${docCode}`}
      size="md"
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-neutral-600">
          Explain what needs to be changed. The creator will be notified.
        </p>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Revision Note *
          </label>
          <textarea
            rows={4}
            placeholder="Describe what needs to be revised…"
            value={note}
            onChange={e => setNote(e.target.value)}
            className="w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 resize-none placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        {error && (
          <p className="text-sm text-danger-600">{error}</p>
        )}

        <DialogFooter>
          <Button variant="secondary" type="button" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="border-warning-500 text-warning-700 hover:bg-warning-50"
            onClick={handleSubmit}
            loading={isPending}
          >
            Request Revision
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  )
}
