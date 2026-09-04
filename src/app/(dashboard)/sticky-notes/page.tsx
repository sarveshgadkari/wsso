import { requireProfile } from '@/lib/auth/session'
import { listStickyNotes } from '@/lib/actions/sticky-notes'
import { StickyNotesBoard, StickyNotesEmptyHint } from '@/components/sticky-notes/StickyNotesBoard'

export const metadata = { title: 'Sticky Notes — WSSO' }

export default async function StickyNotesPage() {
  await requireProfile()
  const notes = await listStickyNotes()

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Sticky Notes</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Every note you pin on a dashboard tab is stored here, with the page it came from.
            Notes are private to you.
          </p>
        </div>
        {notes.length === 0 ? <StickyNotesEmptyHint /> : null}
      </div>

      <StickyNotesBoard notes={notes} />
    </div>
  )
}
