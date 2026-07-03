'use client'

import { Mail, Users } from 'lucide-react'
import type { AnnouncementWithSender } from '@/lib/actions/announcements'

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

interface Props {
  announcements: AnnouncementWithSender[]
}

export function SentAnnouncementsList({ announcements }: Props) {
  const published = announcements.filter(a => a.status === 'published')

  if (published.length === 0) {
    return (
      <div className="card flex h-40 flex-col items-center justify-center gap-2 text-neutral-400">
        <Mail className="h-7 w-7 text-neutral-300" />
        <p className="text-sm">No sent announcements yet</p>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <ul className="divide-y divide-neutral-100">
        {published.map(a => (
          <li key={a.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-900">{a.title}</p>
                <p className="mt-1 line-clamp-2 text-xs text-neutral-500">{a.body}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {a.recipient_ids.length} recipient{a.recipient_ids.length !== 1 ? 's' : ''}
                  </span>
                  <span>{fmtDate(a.published_at)}</span>
                  {a.email_sent_at && (
                    <span className="text-primary-600">Email sent (BCC)</span>
                  )}
                  {a.send_email && !a.email_sent_at && (
                    <span className="text-warning-600">In-app only (email failed)</span>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
