'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Paperclip, Link2, Upload, FileText, ExternalLink, Trash2, Send, MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/lib/store/toast'
import {
  uploadDocument,
  addDocumentLink,
  getDocumentOpenUrl,
  deleteDocument,
  type DocumentMeta,
} from '@/lib/actions/documents'
import { submitWorkUpdate } from '@/lib/actions/tactics'
import type { TacticStatus, UserRole } from '@/lib/types'

export interface WorkUpdateEntry {
  id:         string
  notes:      string | null
  created_at: string
  actor:      { full_name: string } | null
}

interface Props {
  tacticId:         string
  tacticCode:       string
  status:           TacticStatus
  role:             UserRole
  currentUserId:    string
  assignedTo:       string
  initialDocuments: DocumentMeta[]
  workUpdates:      WorkUpdateEntry[]
}

export function WorkOrderWorkPanel({
  tacticId,
  tacticCode,
  status,
  role,
  currentUserId,
  assignedTo,
  initialDocuments,
  workUpdates,
}: Props) {
  const router = useRouter()
  const toast  = useToast()
  const [docs, setDocs]         = useState(initialDocuments)
  const [note, setNote]         = useState('')
  const [linkUrl, setLinkUrl]   = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [showLink, setShowLink] = useState(false)
  const [isPending, start]      = useTransition()
  const [opening, setOpening]   = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const isAssignee  = assignedTo === currentUserId
  const canContribute = isAssignee && !['done', 'archived', 'review'].includes(status)
  const canAttach   = (isAssignee || role === 'admin' || role === 'manager')
    && !['archived'].includes(status)

  async function handleWorkUpdate() {
    if (!note.trim()) return
    start(async () => {
      try {
        await submitWorkUpdate(tacticId, note)
        setNote('')
        toast.success('Work update saved')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save update')
      }
    })
  }

  async function handleFileUpload(file: File) {
    start(async () => {
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('entity_type', 'tactic')
        fd.append('entity_id', tacticId)
        const doc = await uploadDocument(fd)
        setDocs(prev => [doc, ...prev])
        toast.success('File attached')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed')
      }
    })
  }

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault()
    if (!linkUrl.trim()) return
    start(async () => {
      try {
        const doc = await addDocumentLink({
          url:         linkUrl,
          title:       linkTitle || undefined,
          entity_type: 'tactic',
          entity_id:   tacticId,
        })
        setDocs(prev => [doc, ...prev])
        setLinkUrl('')
        setLinkTitle('')
        setShowLink(false)
        toast.success('Link added')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not add link')
      }
    })
  }

  async function handleOpen(doc: DocumentMeta) {
    setOpening(doc.id)
    try {
      const url = await getDocumentOpenUrl(doc.id)
      window.open(url, '_blank', 'noopener')
    } catch {
      toast.error('Could not open')
    } finally {
      setOpening(null)
    }
  }

  async function handleDelete(doc: DocumentMeta) {
    if (!confirm(`Remove "${doc.file_name}"?`)) return
    setDeleting(doc.id)
    try {
      await deleteDocument(doc.id)
      setDocs(prev => prev.filter(d => d.id !== doc.id))
      toast.success('Removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-primary-500" />
        <h3 className="text-sm font-semibold text-neutral-800">Your work &amp; attachments</h3>
      </div>

      {canContribute && (
        <div className="mb-5 flex flex-col gap-3">
          <p className="text-xs text-neutral-500">
            Describe what you did, attach files or links, then use <strong>Move to Review</strong> above when ready for your manager.
          </p>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="What did you work on? Add progress notes here…"
            rows={3}
            className="w-full resize-y rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <Button
            size="sm"
            variant="secondary"
            onClick={handleWorkUpdate}
            loading={isPending}
            disabled={!note.trim()}
          >
            <Send className="h-3.5 w-3.5" />
            Save work update
          </Button>
        </div>
      )}

      {status === 'review' && isAssignee && (
        <p className="mb-4 rounded-lg bg-primary-50 px-3 py-2 text-xs text-primary-700">
          Submitted for review — your manager will approve or send back with feedback.
        </p>
      )}

      {canAttach && (
        <div className="mb-4 flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFileUpload(f)
              if (fileRef.current) fileRef.current.value = ''
            }}
          />
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={isPending}>
            <Upload className="h-3.5 w-3.5" />
            Upload file
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowLink(v => !v)} disabled={isPending}>
            <Link2 className="h-3.5 w-3.5" />
            Add link
          </Button>
        </div>
      )}

      {showLink && canAttach && (
        <form onSubmit={handleAddLink} className="mb-4 flex flex-col gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <input
            type="url"
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            placeholder="https://…"
            required
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <input
            type="text"
            value={linkTitle}
            onChange={e => setLinkTitle(e.target.value)}
            placeholder="Link title (optional)"
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={isPending} disabled={!linkUrl.trim()}>
              Add link
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setShowLink(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {workUpdates.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-neutral-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Work updates
            </h4>
          </div>
          <ul className="flex flex-col gap-2">
            {workUpdates.map(u => (
              <li key={u.id} className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2">
                <p className="whitespace-pre-wrap text-sm text-neutral-700">{u.notes}</p>
                <p className="mt-1 text-xs text-neutral-400">
                  {u.actor?.full_name ?? 'Unknown'} · {new Date(u.created_at).toLocaleString([], {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {docs.length === 0 ? (
        <p className="text-sm text-neutral-400">No files or links attached yet.</p>
      ) : (
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-100">
          {docs.map(doc => {
            const isLink = doc.source_type === 'link'
            const canDelete = doc.uploaded_by === currentUserId || role === 'admin'
            return (
              <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  {isLink
                    ? <Link2 className="h-4 w-4 shrink-0 text-primary-500" />
                    : <FileText className="h-4 w-4 shrink-0 text-neutral-400" />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-800">{doc.file_name}</p>
                    <p className="text-xs text-neutral-400">
                      {isLink ? 'Link' : 'File'} · {tacticCode}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => handleOpen(doc)}
                    disabled={opening === doc.id}
                    className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-primary-600"
                    title={isLink ? 'Open link' : 'Download'}
                  >
                    {opening === doc.id
                      ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
                      : <ExternalLink className="h-4 w-4" />}
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={deleting === doc.id}
                      className="rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-danger-600"
                    >
                      {deleting === doc.id
                        ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-danger-400 border-t-transparent" />
                        : <Trash2 className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
