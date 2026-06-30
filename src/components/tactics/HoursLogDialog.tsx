'use client'

import { useState, useTransition } from 'react'
import { Clock } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/lib/store/toast'
import { logHours } from '@/lib/actions/tactics'

interface Props {
  tacticId: string
  onLogged: () => void
}

export function HoursLogDialog({ tacticId, onLogged }: Props) {
  const toast = useToast()
  const [open,       setOpen]       = useState(false)
  const [hours,      setHours]      = useState('')
  const [notes,      setNotes]      = useState('')
  const [isPending,  startTransition] = useTransition()

  function handleOpen() { setOpen(true) }
  function handleClose() { setOpen(false); setHours(''); setNotes('') }

  function handleSubmit() {
    const h = parseFloat(hours)
    if (isNaN(h) || h <= 0 || h > 24) {
      toast.error('Enter a value between 0.1 and 24 hours')
      return
    }
    startTransition(async () => {
      try {
        await logHours(tacticId, { hours: h, notes: notes || undefined })
        toast.success(`Logged ${h}h`)
        handleClose()
        onLogged()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to log hours')
      }
    })
  }

  const textareaClass =
    'w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 ' +
    'placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 ' +
    'focus:ring-primary-500 resize-none'

  return (
    <>
      <Button size="sm" variant="secondary" onClick={handleOpen}>
        <Clock className="h-3.5 w-3.5" />
        Log hours
      </Button>

      <Dialog open={open} onClose={handleClose} title="Log hours" size="sm">
        <div className="flex flex-col gap-4">
          <Input
            label="Hours *"
            type="number"
            step="0.1"
            min="0.1"
            max="24"
            placeholder="e.g. 2.5"
            value={hours}
            onChange={e => setHours(e.target.value)}
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700">Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What did you work on?"
              className={textareaClass}
            />
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button loading={isPending} onClick={handleSubmit}>Log hours</Button>
          </DialogFooter>
        </div>
      </Dialog>
    </>
  )
}
