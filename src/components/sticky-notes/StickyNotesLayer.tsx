'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Minus, Plus, StickyNote, X } from 'lucide-react'
import {
  createStickyNote,
  deleteStickyNote,
  listStickyNotes,
  updateStickyNote,
} from '@/lib/actions/sticky-notes'
import {
  resolveStickyNotePage,
  STICKY_NOTE_COLORS,
  stickyNotePaper,
  type StickyNoteColor,
} from '@/lib/sticky-notes/pages'
import type { StickyNote as StickyNoteRow } from '@/lib/types'
import { useToast } from '@/lib/store/toast'
import { cn } from '@/lib/utils'

const NOTE_W = 220
const NOTE_H = 196
const MINI_H = 36

export function StickyNotesLayer() {
  const pathname = usePathname()
  const page = resolveStickyNotePage(pathname)
  const hideOnBoard = page.path === '/sticky-notes'
  const toast = useToast()
  const [notes, setNotes] = useState<StickyNoteRow[]>([])
  const [ready, setReady] = useState(false)
  const surfaceRef = useRef<HTMLDivElement>(null)

  const reload = useCallback(async () => {
    const rows = await listStickyNotes()
    setNotes(rows)
    setReady(true)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const onPage = notes.filter((n) => n.page_path === page.path)

  async function addNote() {
    const res = await createStickyNote(pathname)
    if (res.error) {
      toast.error('Could not save the note.')
      return
    }
    if (res.data) setNotes((prev) => [res.data!, ...prev])
  }

  function patchLocal(id: string, patch: Partial<StickyNoteRow>) {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  }

  if (hideOnBoard) return null

  return (
    <div ref={surfaceRef} className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
      {ready &&
        onPage.map((note) => (
          <FloatingNote
            key={note.id}
            note={note}
            boundsRef={surfaceRef}
            onPatch={patchLocal}
            onDeleted={(id) => setNotes((prev) => prev.filter((n) => n.id !== id))}
          />
        ))}

      <button
        type="button"
        onClick={() => void addNote()}
        className="pointer-events-auto absolute bottom-5 right-5 z-30 flex h-11 items-center gap-2 rounded-full bg-amber-300 px-4 text-sm font-semibold text-amber-950 shadow-lg shadow-amber-900/10 hover:bg-amber-200"
        title={`Add a sticky note on ${page.label}`}
      >
        <Plus className="h-4 w-4" />
        <StickyNote className="h-4 w-4" />
        <span className="hidden sm:inline">Note</span>
      </button>
    </div>
  )
}

function FloatingNote({
  note,
  boundsRef,
  onPatch,
  onDeleted,
}: {
  note: StickyNoteRow
  boundsRef: React.RefObject<HTMLDivElement | null>
  onPatch: (id: string, patch: Partial<StickyNoteRow>) => void
  onDeleted: (id: string) => void
}) {
  const paper = stickyNotePaper(note.color)
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const pos = useRef({ x: note.pos_x, y: note.pos_y })
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [title, setTitle] = useState(note.title)
  const [body, setBody] = useState(note.body)

  useEffect(() => {
    pos.current = { x: note.pos_x, y: note.pos_y }
  }, [note.pos_x, note.pos_y])

  useEffect(() => {
    setTitle(note.title)
    setBody(note.body)
  }, [note.id, note.title, note.body])

  function queueSave(patch: Parameters<typeof updateStickyNote>[1]) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void updateStickyNote(note.id, patch)
    }, 400)
  }

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button, textarea, input')) return
    const bounds = boundsRef.current?.getBoundingClientRect()
    if (!bounds) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = {
      dx: e.clientX - bounds.left - pos.current.x,
      dy: e.clientY - bounds.top - pos.current.y,
    }
    const z_index = Date.now() % 10000
    onPatch(note.id, { z_index })
    void updateStickyNote(note.id, { z_index })
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    const bounds = boundsRef.current?.getBoundingClientRect()
    if (!bounds) return
    const maxX = Math.max(0, bounds.width - NOTE_W)
    const maxY = Math.max(0, bounds.height - (note.minimized ? MINI_H : NOTE_H))
    const pos_x = Math.min(maxX, Math.max(0, e.clientX - bounds.left - drag.current.dx))
    const pos_y = Math.min(maxY, Math.max(0, e.clientY - bounds.top - drag.current.dy))
    pos.current = { x: pos_x, y: pos_y }
    onPatch(note.id, { pos_x, pos_y })
  }

  function onPointerUp() {
    if (!drag.current) return
    drag.current = null
    void updateStickyNote(note.id, { pos_x: pos.current.x, pos_y: pos.current.y })
  }

  async function remove() {
    onDeleted(note.id)
    await deleteStickyNote(note.id)
  }

  return (
    <div
      className="pointer-events-auto absolute flex flex-col"
      style={{
        left: note.pos_x,
        top: note.pos_y,
        width: NOTE_W,
        height: note.minimized ? MINI_H : NOTE_H,
        zIndex: note.z_index,
        background: paper.paper,
        color: paper.ink,
        boxShadow: '2px 4px 10px rgba(0,0,0,0.18)',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="flex h-9 shrink-0 cursor-grab items-center gap-1 px-2 active:cursor-grabbing">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value)
            onPatch(note.id, { title: e.target.value })
            queueSave({ title: e.target.value })
          }}
          placeholder="Title"
          className="min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none placeholder:opacity-50"
          style={{ color: paper.ink }}
        />
        <button
          type="button"
          className="rounded p-0.5 opacity-70 hover:opacity-100"
          onClick={() => {
            const minimized = !note.minimized
            onPatch(note.id, { minimized })
            void updateStickyNote(note.id, { minimized })
          }}
          title={note.minimized ? 'Expand' : 'Minimize'}
        >
          {note.minimized ? <StickyNote className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
        </button>
        <button type="button" className="rounded p-0.5 opacity-70 hover:opacity-100" onClick={() => void remove()} title="Delete">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {!note.minimized && (
        <>
          <textarea
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              onPatch(note.id, { body: e.target.value })
              queueSave({ body: e.target.value })
            }}
            placeholder="Write a note…"
            className="min-h-0 flex-1 resize-none bg-transparent px-2 pb-1 text-sm leading-snug outline-none placeholder:opacity-40"
            style={{ color: paper.ink }}
          />
          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex gap-1">
              {STICKY_NOTE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  title={c.label}
                  className={cn(
                    'h-3.5 w-3.5 rounded-full border border-black/10',
                    note.color === c.id && 'ring-2 ring-black/40',
                  )}
                  style={{ background: c.paper }}
                  onClick={() => {
                    onPatch(note.id, { color: c.id })
                    void updateStickyNote(note.id, { color: c.id as StickyNoteColor })
                  }}
                />
              ))}
            </div>
            <span className="truncate text-[10px] opacity-60">{note.page_label}</span>
          </div>
        </>
      )}
    </div>
  )
}
