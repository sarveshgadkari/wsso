'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, ChevronRight, ClipboardList, Activity, UserCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getNotifications, markRead, markAllRead } from '@/lib/actions/notifications'
import type { Notification } from '@/lib/types'

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function NotifIcon({ type }: { type: string }) {
  if (type === 'tactic_assigned') return <UserCheck className="h-4 w-4 text-primary-500" />
  if (type === 'tactic_review')   return <ClipboardList className="h-4 w-4 text-warning-500" />
  return <Activity className="h-4 w-4 text-neutral-400" />
}

interface Props {
  initialCount: number
  userId:       string
}

export function NotificationBell({ initialCount, userId }: Props) {
  const router                        = useRouter()
  const containerRef                  = useRef<HTMLDivElement>(null)
  const [open,       setOpen]         = useState(false)
  const [count,      setCount]        = useState(initialCount)
  const [notifs,     setNotifs]       = useState<Notification[]>([])
  const [loaded,     setLoaded]       = useState(false)
  const [isPending,  start]           = useTransition()

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Load notifications when dropdown opens
  useEffect(() => {
    if (!open) return
    start(async () => {
      const data = await getNotifications(15)
      setNotifs(data)
      setLoaded(true)
      // Sync count from fresh data
      setCount(data.filter(n => !n.is_read).length)
    })
  }, [open])

  // Supabase Realtime — live updates for this user's notifications
  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase
      .channel(`notifs-${userId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        const n = payload.new as Notification
        setCount(c => c + 1)
        setNotifs(prev => [n, ...prev].slice(0, 15))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  async function handleNotifClick(n: Notification) {
    setOpen(false)
    // Optimistic mark read
    if (!n.is_read) {
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x))
      setCount(c => Math.max(0, c - 1))
      await markRead(n.id)
    }
    if (n.link) router.push(n.link)
  }

  async function handleMarkAll() {
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
    setCount(0)
    await markAllRead()
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        aria-label={`Notifications${count > 0 ? ` (${count} unread)` : ''}`}
        onClick={() => setOpen(o => !o)}
        className="relative text-neutral-500 hover:text-neutral-700 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span
            aria-hidden
            className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary-600 px-0.5 text-[9px] font-bold text-white leading-none"
          >
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-80 rounded-xl border border-neutral-200 bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-neutral-800">Notifications</h3>
            {count > 0 && (
              <button
                onClick={handleMarkAll}
                className="flex items-center gap-1 text-xs text-primary-600 hover:underline"
              >
                <CheckCheck className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <ul className="max-h-[360px] overflow-y-auto divide-y divide-neutral-50">
            {isPending && !loaded ? (
              <li className="flex h-20 items-center justify-center text-sm text-neutral-400">Loading…</li>
            ) : notifs.length === 0 ? (
              <li className="flex h-20 items-center justify-center text-sm text-neutral-400">
                No notifications
              </li>
            ) : (
              notifs.map(n => (
                <li key={n.id}>
                  <button
                    onClick={() => handleNotifClick(n)}
                    className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-neutral-50 ${
                      !n.is_read ? 'bg-primary-50/40' : ''
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <NotifIcon type={n.type} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xs leading-relaxed ${!n.is_read ? 'font-medium text-neutral-800' : 'text-neutral-600'}`}>
                        {n.message}
                      </p>
                      <p className="mt-0.5 text-[10px] text-neutral-400">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>

          {/* Footer */}
          <div className="border-t border-neutral-100 px-4 py-2.5">
            <button
              onClick={() => { setOpen(false); router.push('/notifications') }}
              className="flex w-full items-center justify-center gap-1 text-xs text-primary-600 hover:underline"
            >
              View all notifications <ChevronRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
