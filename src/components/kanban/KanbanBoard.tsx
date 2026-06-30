'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { AlertCircle, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { useToast } from '@/lib/store/toast'
import { transitionStatus } from '@/lib/actions/tactics'
import { createClient } from '@/lib/supabase/client'
import {
  STATUS_LABEL,
  PRIORITY_LABEL, PRIORITY_VARIANT,
  getAllowedNext,
} from '@/lib/tactics-utils'
import type { TacticRow } from '@/components/tactics/TacticDialog'
import type { TacticStatus, TacticPriority, UserRole } from '@/lib/types'

// Columns shown on the board (archived hidden by default)
const BOARD_STATUSES: TacticStatus[] = ['assigned', 'in_progress', 'review', 'done']

// Column accent colours
const COLUMN_HEADER: Record<TacticStatus, string> = {
  assigned:    'border-neutral-300',
  in_progress: 'border-warning-400',
  review:      'border-primary-400',
  done:        'border-success-400',
  archived:    'border-neutral-300',
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

// ─── Draggable card ────────────────────────────────────────────────────────────

function KanbanCard({
  tactic,
  isBeingDragged,
}: {
  tactic:         TacticRow
  isBeingDragged?: boolean
}) {
  const router = useRouter()
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: tactic.id })
  const today    = todayStr()
  const isOverdue  = tactic.due_date && tactic.due_date < today  && tactic.status !== 'done'
  const isDueToday = tactic.due_date && tactic.due_date === today && tactic.status !== 'done'

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'group rounded-lg border border-neutral-200 bg-white p-3 shadow-sm',
        'cursor-grab active:cursor-grabbing select-none transition-opacity',
        isBeingDragged && 'opacity-40',
      )}
    >
      {/* Code + priority */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-neutral-400">{tactic.code}</span>
        <Badge variant={PRIORITY_VARIANT[tactic.priority as TacticPriority]}>
          {PRIORITY_LABEL[tactic.priority as TacticPriority]}
        </Badge>
      </div>

      {/* Title */}
      <p className="mb-2 line-clamp-2 text-sm font-medium text-neutral-800">{tactic.title}</p>

      {/* Assignee */}
      <div className="flex items-center gap-1.5 text-xs text-neutral-500">
        <User className="h-3 w-3 shrink-0" />
        <span className="truncate">{tactic.assignee.full_name}</span>
      </div>

      {/* Project + due date */}
      <div className="mt-2 flex items-center justify-between gap-2">
        {tactic.project && (
          <span className="truncate text-xs text-neutral-400">{tactic.project.name}</span>
        )}
        {tactic.due_date && (
          <span className={cn(
            'shrink-0 flex items-center gap-0.5 text-xs',
            isOverdue  ? 'font-medium text-red-600'
            : isDueToday ? 'font-medium text-amber-600'
            : 'text-neutral-400',
          )}>
            {isOverdue && <AlertCircle className="h-3 w-3" />}
            {new Date(tactic.due_date + 'T00:00:00').toLocaleDateString([], {
              month: 'short', day: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Open detail on click (only when not dragging) */}
      <button
        className="mt-2 w-full rounded text-xs text-neutral-400 hover:text-primary-600 text-right opacity-0 group-hover:opacity-100 transition-opacity"
        onPointerDown={e => e.stopPropagation()}
        onClick={() => router.push(`/tactics/${tactic.id}`)}
      >
        Open →
      </button>
    </div>
  )
}

// ─── Droppable column ──────────────────────────────────────────────────────────

function KanbanColumn({
  status, tactics, activeId,
}: {
  status:   TacticStatus
  tactics:  TacticRow[]
  activeId: UniqueIdentifier | null
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div className="flex min-w-[220px] flex-1 flex-col gap-2">
      {/* Column header */}
      <div className={cn('flex items-center justify-between rounded-lg border-l-4 bg-white px-3 py-2 shadow-sm', COLUMN_HEADER[status])}>
        <h3 className="text-sm font-semibold text-neutral-700">{STATUS_LABEL[status]}</h3>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-100 px-1.5 text-xs font-medium text-neutral-500">
          {tactics.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col gap-2 rounded-xl border-2 border-dashed p-2 transition-colors',
          'min-h-[120px]',
          isOver
            ? 'border-primary-400 bg-primary-50'
            : 'border-neutral-200 bg-neutral-50/60',
        )}
      >
        {tactics.map(t => (
          <KanbanCard key={t.id} tactic={t} isBeingDragged={t.id === activeId} />
        ))}
        {tactics.length === 0 && (
          <div className="flex flex-1 items-center justify-center py-8 text-xs text-neutral-300">
            Drop here
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Board ─────────────────────────────────────────────────────────────────────

interface Props {
  initialTactics: TacticRow[]
  role:           UserRole
  currentUserId:  string
}

export function KanbanBoard({ initialTactics, role }: Props) {
  const toast = useToast()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [tactics,      setTactics]      = useState<TacticRow[]>(initialTactics)
  const [activeId,     setActiveId]     = useState<UniqueIdentifier | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [sendBackOpen, setSendBackOpen] = useState(false)
  const [sendBackComment, setSendBackComment] = useState('')
  const [pendingMove,  setPendingMove]  = useState<{
    tacticId: string
    prevStatus: TacticStatus
  } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // Supabase Realtime — sync status changes from other sessions
  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase
      .channel('kanban-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tactics' },
        payload => {
          const updated = payload.new as { id: string; status: TacticStatus; updated_at: string }
          setTactics(prev =>
            prev.map(t =>
              t.id === updated.id
                ? { ...t, status: updated.status, updated_at: updated.updated_at }
                : t,
            ),
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tactics' },
        () => { router.refresh() },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDragStart({ active }: DragStartEvent) {
    setActiveId(active.id)
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveId(null)
    if (!over) return

    const tacticId     = active.id as string
    const targetStatus = over.id   as TacticStatus
    const tactic       = tactics.find(t => t.id === tacticId)
    if (!tactic) return

    const currentStatus = tactic.status as TacticStatus
    if (currentStatus === targetStatus) return

    const allowed = getAllowedNext(currentStatus, role)
    if (!allowed.includes(targetStatus)) {
      toast.error(`Cannot move from ${STATUS_LABEL[currentStatus]} to ${STATUS_LABEL[targetStatus]}`)
      return
    }

    // Optimistic update
    setTactics(prev => prev.map(t => t.id === tacticId ? { ...t, status: targetStatus } : t))

    // review → in_progress requires a comment
    if (currentStatus === 'review' && targetStatus === 'in_progress') {
      setPendingMove({ tacticId, prevStatus: currentStatus })
      setSendBackOpen(true)
      return
    }

    // Fire server action
    startTransition(async () => {
      try {
        await transitionStatus(tacticId, targetStatus)
      } catch (err) {
        // Revert
        setTactics(prev => prev.map(t => t.id === tacticId ? { ...t, status: currentStatus } : t))
        toast.error(err instanceof Error ? err.message : 'Failed to move card')
      }
    })
  }

  function cancelSendBack() {
    if (pendingMove) {
      setTactics(prev =>
        prev.map(t => t.id === pendingMove.tacticId ? { ...t, status: pendingMove.prevStatus } : t),
      )
    }
    setSendBackOpen(false)
    setSendBackComment('')
    setPendingMove(null)
  }

  function confirmSendBack() {
    if (!sendBackComment.trim()) { toast.error('Please enter a reason'); return }
    if (!pendingMove) return

    const { tacticId } = pendingMove
    setSendBackOpen(false)
    setSendBackComment('')
    setPendingMove(null)

    startTransition(async () => {
      try {
        await transitionStatus(tacticId, 'in_progress', sendBackComment.trim())
        toast.success(`Moved to ${STATUS_LABEL['in_progress']}`)
      } catch (err) {
        // Revert on failure
        setTactics(prev =>
          prev.map(t => t.id === tacticId ? { ...t, status: 'review' } : t),
        )
        toast.error(err instanceof Error ? err.message : 'Failed to send back')
      }
    })
  }

  const activeTactic = activeId ? tactics.find(t => t.id === activeId) : null
  const visibleCols  = showArchived ? [...BOARD_STATUSES, 'archived' as TacticStatus] : BOARD_STATUSES

  const textareaClass =
    'w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 ' +
    'placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 ' +
    'focus:ring-primary-500 resize-none'

  return (
    <>
      {/* Controls */}
      <div className="mb-4 flex items-center justify-between gap-4">
        <p className="text-sm text-neutral-500">
          Drag cards between columns to update status. Changes sync live across sessions.
        </p>
        <Button
          size="sm"
          variant={showArchived ? 'primary' : 'secondary'}
          onClick={() => setShowArchived(v => !v)}
        >
          {showArchived ? 'Hide archived' : 'Show archived'}
        </Button>
      </div>

      {/* Board */}
      <div className="overflow-x-auto pb-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4" style={{ minWidth: `${visibleCols.length * 260}px` }}>
            {visibleCols.map(status => (
              <KanbanColumn
                key={status}
                status={status}
                tactics={tactics.filter(t => t.status === status)}
                activeId={activeId}
              />
            ))}
          </div>

          <DragOverlay>
            {activeTactic && (
              <div className="rotate-1 scale-105 rounded-lg border border-primary-300 bg-white p-3 shadow-xl opacity-95">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-neutral-400">{activeTactic.code}</span>
                  <Badge variant={PRIORITY_VARIANT[activeTactic.priority as TacticPriority]}>
                    {PRIORITY_LABEL[activeTactic.priority as TacticPriority]}
                  </Badge>
                </div>
                <p className="line-clamp-2 text-sm font-medium text-neutral-800">{activeTactic.title}</p>
                <div className="mt-2 flex items-center gap-1.5 text-xs text-neutral-500">
                  <User className="h-3 w-3 shrink-0" />
                  {activeTactic.assignee.full_name}
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Send-back comment dialog */}
      <Dialog
        open={sendBackOpen}
        onClose={cancelSendBack}
        title="Send back to In Progress"
        description="Provide a reason so the assignee knows what to revise."
        size="sm"
      >
        <div className="flex flex-col gap-3">
          <textarea
            rows={3}
            value={sendBackComment}
            onChange={e => setSendBackComment(e.target.value)}
            placeholder="e.g. The deliverable is missing the sign-off section…"
            className={textareaClass}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={cancelSendBack}>Cancel</Button>
            <Button loading={isPending} onClick={confirmSendBack}>Send back</Button>
          </DialogFooter>
        </div>
      </Dialog>
    </>
  )
}
