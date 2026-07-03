'use client'

import { useState } from 'react'
import { Megaphone, Mail, Users } from 'lucide-react'
import type { AnnouncementWithSender } from '@/lib/actions/announcements'
import type { Announcement, Profile } from '@/lib/types'
import type { AnnouncementRecipient } from '@/lib/actions/announcements'
import { AnnouncementsFeed } from './AnnouncementsFeed'
import { AnnouncementComposer } from './AnnouncementComposer'
import { SentAnnouncementsList } from './SentAnnouncementsList'

type Tab = 'feed' | 'compose' | 'sent'

interface Props {
  viewer:          Profile
  canSend:         boolean
  feed:            AnnouncementWithSender[]
  sent:            AnnouncementWithSender[]
  drafts:          Announcement[]
  recipients:      AnnouncementRecipient[]
  initialTab?:     Tab
}

export function AnnouncementsShell({
  viewer,
  canSend,
  feed,
  sent,
  drafts,
  recipients,
  initialTab = 'feed',
}: Props) {
  const [tab, setTab] = useState<Tab>(canSend ? initialTab : 'feed')
  const [editingDraft, setEditingDraft] = useState<Announcement | null>(null)

  const tabs: { id: Tab; label: string; icon: typeof Megaphone; show: boolean }[] = [
    { id: 'feed',    label: 'Announcements', icon: Megaphone, show: true },
    { id: 'compose', label: 'Send',          icon: Mail,      show: canSend },
    { id: 'sent',    label: 'Sent',          icon: Users,     show: canSend },
  ]

  function handleEditDraft(draft: Announcement) {
    setEditingDraft(draft)
    setTab('compose')
  }

  function handleComposeDone() {
    setEditingDraft(null)
    setTab('sent')
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Announcements</h2>
        <p className="mt-1 text-sm text-neutral-500">
          {canSend
            ? 'Send team updates by email (BCC) and in-app notification.'
            : 'Company announcements sent to you.'}
        </p>
      </div>

      <div className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
        {tabs.filter(t => t.show).map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {t.id === 'feed' && feed.length > 0 && (
                <span className="rounded-full bg-primary-100 px-1.5 py-0.5 text-[10px] font-bold text-primary-700">
                  {feed.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'feed' && <AnnouncementsFeed announcements={feed} />}

      {tab === 'compose' && canSend && (
        <AnnouncementComposer
          recipients={recipients}
          drafts={drafts}
          editingDraft={editingDraft}
          onEditDraft={handleEditDraft}
          onDone={handleComposeDone}
          onCancelEdit={() => setEditingDraft(null)}
          senderName={viewer?.full_name ?? 'Unknown'}
        />
      )}

      {tab === 'sent' && canSend && (
        <SentAnnouncementsList announcements={sent} />
      )}
    </div>
  )
}
