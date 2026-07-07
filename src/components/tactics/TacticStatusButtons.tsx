'use client'

import { useState, useTransition } from 'react'
import { CheckCircle, RotateCcw, Archive, Play, ArrowRight } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/lib/store/toast'
import { transitionStatus } from '@/lib/actions/tactics'
import { getAllowedNext, STATUS_LABEL } from '@/lib/tactics-utils'
import type { TacticStatus, UserRole } from '@/lib/types'

interface Props {
  tacticId:         string
  currentStatus:    TacticStatus
  role:             UserRole
  pendingWorkNote?: string
  onWorkNoteConsumed?: () => void
  onTransitioned:   (newStatus: TacticStatus) => void
}

const ICONS: Partial<Record<TacticStatus, React.ComponentType<{ className?: string }>>> = {
  in_progress: Play,
  review:      ArrowRight,
  done:        CheckCircle,
  archived:    Archive,
}

export function TacticStatusButtons({
  tacticId, currentStatus, role, pendingWorkNote, onWorkNoteConsumed, onTransitioned,
}: Props) {
  const toast = useToast()
  const [isPending, startTransition] = useTransition()
  const [sendBackOpen, setSendBackOpen] = useState(false)
  const [comment,      setComment]      = useState('')

  const allowed = getAllowedNext(currentStatus, role)
  if (allowed.length === 0) return null

  function handleClick(target: TacticStatus) {
    if (currentStatus === 'review' && target === 'in_progress') {
      setSendBackOpen(true)
      return
    }
    doTransition(target, undefined)
  }

  function doTransition(target: TacticStatus, c?: string) {
    const workNotes = target === 'review' ? pendingWorkNote : undefined
    startTransition(async () => {
      try {
        await transitionStatus(tacticId, target, c, workNotes)
        if (target === 'review' && workNotes?.trim()) onWorkNoteConsumed?.()
        onTransitioned(target)
        toast.success(`Moved to ${STATUS_LABEL[target]}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update status')
      }
    })
  }

  const textareaClass =
    'w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 ' +
    'placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 ' +
    'focus:ring-primary-500 resize-none'

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {allowed.map(target => {
          const isSendBack = currentStatus === 'review' && target === 'in_progress'
          const Icon       = isSendBack ? RotateCcw : (ICONS[target] ?? ArrowRight)
          const label      = isSendBack ? 'Send back' : `Move to ${STATUS_LABEL[target]}`
          const variant    = target === 'done'
            ? 'primary'
            : target === 'archived' || isSendBack
              ? 'secondary'
              : 'primary'

          return (
            <Button
              key={`${target}-${isSendBack}`}
              size="sm"
              variant={variant}
              loading={isPending}
              onClick={() => handleClick(target)}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          )
        })}
      </div>

      <Dialog
        open={sendBackOpen}
        onClose={() => { setSendBackOpen(false); setComment('') }}
        title="Send back to In Progress"
        description="Provide a reason so the assignee knows what to revise."
        size="sm"
      >
        <div className="flex flex-col gap-3">
          <textarea
            rows={3}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="e.g. The deliverable is missing the sign-off section…"
            className={textareaClass}
          />

          <DialogFooter>
            <Button variant="secondary" onClick={() => { setSendBackOpen(false); setComment('') }}>
              Cancel
            </Button>
            <Button
              loading={isPending}
              onClick={() => {
                if (!comment.trim()) {
                  toast.error('Please enter a reason')
                  return
                }
                setSendBackOpen(false)
                doTransition('in_progress', comment.trim())
                setComment('')
              }}
            >
              Send back
            </Button>
          </DialogFooter>
        </div>
      </Dialog>
    </>
  )
}
