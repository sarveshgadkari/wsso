'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckCheck, ClipboardList, Activity, UserCheck, Bell,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { markRead, markAllRead } from '@/lib/actions/notifications'
import type { Notification } from '@/lib/types'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7)  return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'tactic_assigned') return <UserCheck className="h-4 w-4 text-primary-500" />
  if (type === 'tactic_review')   return <ClipboardList className="h-4 w-4 text-warning-500" />
  return <Activity className="h-4 w-4 text-neutral-400" />
}

interface Props {
  notifications: Notification[]
}

export function NotificationsList({ notifications: initial }: Props) {
  const router                    = useRouter()
  const [notifs, setNotifs]       = useState(initial)
  const [isPending, start]        = useTransition()

  const unread = notifs.filter(n => !n.is_read)
  const read   = notifs.filter(n =>  n.is_read)

  async function handleClick(n: Notification) {
    if (!n.is_read) {
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
      await markRead(n.id)
    }
    if (n.link) router.push(n.link)
  }

  function handleMarkAll() {
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    start(async () => { await markAllRead() })
  }

  function NotifRow({ n }: { n: Notification }) {
    return (
      <button
        onClick={() => handleClick(n)}
        className={`flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-neutral-50 ${
          !n.is_read ? 'bg-primary-50/30' : ''
        }`}
      >
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          !n.is_read ? 'bg-primary-100' : 'bg-neutral-100'
        }`}>
          <NotifIcon type={n.type} />
        </div>
        <div className="min-w-0 flex-1">
          <p className={`text-sm leading-relaxed ${!n.is_read ? 'font-medium text-neutral-900' : 'text-neutral-600'}`}>
            {n.message}
          </p>
          <p className="mt-1 text-xs text-neutral-400">{timeAgo(n.created_at)}</p>
        </div>
        {!n.is_read && (
          <div className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary-500" />
        )}
      </button>
    )
  }

  if (notifs.length === 0) {
    return (
      <div className="card flex h-48 flex-col items-center justify-center gap-3 text-neutral-400">
        <Bell className="h-8 w-8 text-neutral-300" />
        <p className="text-sm">No notifications yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Actions bar */}
      {unread.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            {unread.length} unread notification{unread.length !== 1 ? 's' : ''}
          </p>
          <Button variant="ghost" size="sm" onClick={handleMarkAll} loading={isPending}>
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </Button>
        </div>
      )}

      {/* Unread */}
      {unread.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-neutral-100 bg-primary-50/30 px-5 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">Unread</p>
          </div>
          <ul className="divide-y divide-neutral-100">
            {unread.map(n => <li key={n.id}><NotifRow n={n} /></li>)}
          </ul>
        </div>
      )}

      {/* Read */}
      {read.length > 0 && (
        <div className="card overflow-hidden">
          {unread.length > 0 && (
            <div className="border-b border-neutral-100 bg-neutral-50 px-5 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Earlier</p>
            </div>
          )}
          <ul className="divide-y divide-neutral-100">
            {read.map(n => <li key={n.id}><NotifRow n={n} /></li>)}
          </ul>
        </div>
      )}
    </div>
  )
}
