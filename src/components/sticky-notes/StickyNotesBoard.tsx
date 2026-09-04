'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, StickyNote, Trash2 } from 'lucide-react'
import { deleteStickyNote } from '@/lib/actions/sticky-notes'
import { stickyNotePaper } from '@/lib/sticky-notes/pages'
import type { StickyNote as StickyNoteRow } from '@/lib/types'
import { Button } from '@/components/ui/Button'

interface Props {
  notes: StickyNoteRow[]
}

export function StickyNotesBoard({ notes: initial }: Props) {
  const router = useRouter()
  const [notes, setNotes] = useState(initial)
  const [pending, start] = useTransition()

  const groups = useMemo(() => {
    const map = new Map<string, { label: string; path: string; items: StickyNoteRow[] }>()
    notes.forEach((n) => {
      const key = n.page_path
      const existing = map.get(key)
      if (existing) existing.items.push(n)
      else map.set(key, { label: n.page_label, path: n.page_path, items: [n] })
    })
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
  }, [notes])

  function remove(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id))
    start(async () => {
      await deleteStickyNote(id)
      router.refresh()
    })
  }

  if (notes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
        <StickyNote className="mx-auto h-8 w-8 text-amber-400" />
        <p className="mt-3 text-sm font-medium text-neutral-800">No sticky notes yet</p>
        <p className="mt-1 text-sm text-neutral-500">
          Open any dashboard tab and click the yellow <strong>Note</strong> button in the corner.
          Notes stay on that page and also appear here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.path} className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-neutral-800">{group.label}</h3>
            <Link href={group.path} className="text-xs font-medium text-primary-600 hover:underline">
              Open tab
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((note) => {
              const paper = stickyNotePaper(note.color)
              return (
                <article
                  key={note.id}
                  className="flex min-h-[140px] flex-col p-3 shadow-sm"
                  style={{ background: paper.paper, color: paper.ink }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {note.title.trim() || 'Untitled note'}
                    </p>
                    <button
                      type="button"
                      className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
                      onClick={() => remove(note.id)}
                      disabled={pending}
                      title="Delete"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="mt-2 flex-1 whitespace-pre-wrap text-sm leading-snug">
                    {note.body.trim() || <span className="opacity-50">Empty</span>}
                  </p>
                  <p className="mt-3 text-[10px] opacity-60">
                    From {note.page_label}
                    {' · '}
                    {new Date(note.updated_at).toLocaleString()}
                  </p>
                </article>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

export function StickyNotesEmptyHint() {
  return (
    <Link href="/dashboard">
      <Button size="sm" variant="secondary">
        <Plus className="h-3.5 w-3.5" />
        Go to Dashboard to add a note
      </Button>
    </Link>
  )
}
