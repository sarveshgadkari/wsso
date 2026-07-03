'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Send, Save, Trash2, Mail, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import {
  saveAnnouncementDraft,
  publishAnnouncement,
  deleteAnnouncementDraft,
} from '@/lib/actions/announcements'
import type { AnnouncementRecipient } from '@/lib/actions/announcements'
import type { Announcement } from '@/lib/types'

interface Props {
  recipients:    AnnouncementRecipient[]
  drafts:        Announcement[]
  editingDraft:  Announcement | null
  onEditDraft:   (draft: Announcement) => void
  onDone:        () => void
  onCancelEdit:  () => void
  senderName:    string
}

export function AnnouncementComposer({
  recipients,
  drafts,
  editingDraft,
  onEditDraft,
  onDone,
  onCancelEdit,
  senderName,
}: Props) {
  const router = useRouter()
  const [isPending, start] = useTransition()

  const [title, setTitle]           = useState('')
  const [body, setBody]             = useState('')
  const [sendEmail, setSendEmail]   = useState(true)
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [search, setSearch]         = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [success, setSuccess]       = useState<string | null>(null)
  const [draftId, setDraftId]       = useState<string | undefined>()

  useEffect(() => {
    if (editingDraft) {
      setTitle(editingDraft.title)
      setBody(editingDraft.body)
      setSendEmail(editingDraft.send_email)
      setSelected(new Set(editingDraft.recipient_ids))
      setDraftId(editingDraft.id)
      setError(null)
      setSuccess(null)
    }
  }, [editingDraft])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const valid = recipients.filter(r => r?.id && r?.full_name && r?.email)
    if (!q) return valid
    return valid.filter(r =>
      (r.full_name ?? '').toLowerCase().includes(q) ||
      (r.email ?? '').toLowerCase().includes(q) ||
      (r.employee_code ?? '').toLowerCase().includes(q),
    )
  }, [recipients, search])

  const validRecipients = useMemo(
    () => recipients.filter(r => r?.id && r?.full_name && r?.email),
    [recipients],
  )

  const allSelected = validRecipients.length > 0 && selected.size === validRecipients.length

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(validRecipients.map(r => r.id)))
    }
  }

  function resetForm() {
    setTitle('')
    setBody('')
    setSendEmail(true)
    setSelected(new Set())
    setDraftId(undefined)
    setError(null)
    setSuccess(null)
    onCancelEdit()
  }

  async function handleSaveDraft() {
    setError(null)
    setSuccess(null)
    start(async () => {
      const result = await saveAnnouncementDraft({
        id: draftId,
        title,
        body,
        recipientIds: Array.from(selected),
        sendEmail,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      setDraftId(result.data?.id)
      setSuccess('Draft saved')
      router.refresh()
    })
  }

  async function handleSend() {
    setError(null)
    setSuccess(null)
    start(async () => {
      const result = await publishAnnouncement({
        id: draftId,
        title,
        body,
        recipientIds: Array.from(selected),
        sendEmail,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      const msg = result.emailWarning
        ? `Sent in-app. Email warning: ${result.emailWarning}`
        : sendEmail
          ? `Announcement sent to ${selected.size} people (email + notification)`
          : `Announcement sent to ${selected.size} people (notification only)`
      setSuccess(msg)
      resetForm()
      router.refresh()
      onDone()
    })
  }

  async function handleDeleteDraft(id: string) {
    setError(null)
    start(async () => {
      const result = await deleteAnnouncementDraft(id)
      if (result.error) {
        setError(result.error)
        return
      }
      if (draftId === id) resetForm()
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Saved drafts */}
      {drafts.length > 0 && !editingDraft && (
        <div className="card overflow-hidden">
          <div className="border-b border-neutral-100 px-5 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Saved drafts</p>
          </div>
          <ul className="divide-y divide-neutral-100">
            {drafts.map(d => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <button
                  onClick={() => onEditDraft(d)}
                  className="min-w-0 flex-1 text-left hover:opacity-80"
                >
                  <p className="truncate text-sm font-medium text-neutral-800">{d.title || 'Untitled draft'}</p>
                  <p className="text-xs text-neutral-400">
                    {d.recipient_ids.length} recipient{d.recipient_ids.length !== 1 ? 's' : ''}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteDraft(d.id)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4 text-neutral-400" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2 text-sm text-neutral-500">
          <Mail className="h-4 w-4" />
          <span>From: <strong className="text-neutral-700">{senderName}</strong></span>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Subject
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Announcement subject"
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Message
            </label>
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your announcement here…"
              rows={8}
              className="w-full resize-y rounded-lg border border-neutral-300 px-3 py-2 text-sm leading-relaxed focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={e => setSendEmail(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <Mail className="h-4 w-4 text-neutral-400" />
            Send email to recipients (all addresses in BCC)
          </label>
        </div>
      </div>

      {/* Recipient picker */}
      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-neutral-400" />
            <h3 className="text-sm font-semibold text-neutral-700">Recipients</h3>
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-bold text-primary-700">
              {selected.size} selected
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={toggleAll}>
            {allSelected ? 'Deselect all' : 'Select all'}
          </Button>
        </div>

        <div className="border-b border-neutral-100 px-5 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email, or code…"
              className="w-full rounded-lg border border-neutral-200 py-2 pl-9 pr-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        <ul className="max-h-64 divide-y divide-neutral-50 overflow-y-auto">
          {filtered.map(r => (
            <li key={r.id}>
              <label className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-neutral-50">
                <input
                  type="checkbox"
                  checked={selected.has(r.id)}
                  onChange={() => toggleOne(r.id)}
                  className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-neutral-800">{r.full_name ?? 'Unknown'}</p>
                  <p className="truncate text-xs text-neutral-400">
                    {r.employee_code} · {r.email}
                  </p>
                </div>
              </label>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="px-5 py-8 text-center text-sm text-neutral-400">
              {validRecipients.length === 0 ? 'No team members available' : 'No matches'}
            </li>
          )}
        </ul>
      </div>

      {error && (
        <p className="rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</p>
      )}
      {success && (
        <p className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{success}</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSend} loading={isPending} disabled={selected.size === 0}>
          <Send className="h-4 w-4" />
          Send announcement
        </Button>
        <Button variant="secondary" onClick={handleSaveDraft} loading={isPending}>
          <Save className="h-4 w-4" />
          Save draft
        </Button>
        {editingDraft && (
          <Button variant="ghost" onClick={resetForm} disabled={isPending}>
            Cancel edit
          </Button>
        )}
      </div>
    </div>
  )
}
