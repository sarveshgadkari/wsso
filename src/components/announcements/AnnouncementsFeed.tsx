'use client'

import { Megaphone } from 'lucide-react'
import type { AnnouncementWithSender } from '@/lib/actions/announcements'

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface Props {
  announcements: AnnouncementWithSender[]
}

export function AnnouncementsFeed({ announcements }: Props) {
  if (announcements.length === 0) {
    return (
      <div className="card flex h-48 flex-col items-center justify-center gap-3 text-neutral-400">
        <Megaphone className="h-8 w-8 text-neutral-300" />
        <p className="text-sm">No announcements yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {announcements.map(a => (
        <article key={a.id} className="card overflow-hidden">
          <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-neutral-900">{a.title}</h3>
                <p className="mt-0.5 text-xs text-neutral-500">
                  From {a.sender?.full_name ?? 'Unknown'}
                  {a.published_at && <> · {timeAgo(a.published_at)}</>}
                </p>
              </div>
              {a.email_sent_at && (
                <span className="shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-600">
                  Emailed
                </span>
              )}
            </div>
          </div>
          <div className="px-5 py-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{a.body}</p>
          </div>
        </article>
      ))}
    </div>
  )
}
