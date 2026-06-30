'use client'

import { Clock, CheckCircle, Plus, Pencil, RotateCcw } from 'lucide-react'

export interface ActivityLogRow {
  id:           string
  tactic_id:    string
  employee_id:  string
  action:       string
  hours_logged: number | null
  notes:        string | null
  created_at:   string
  actor: { id: string; full_name: string; employee_code: string }
}

interface Props {
  logs: ActivityLogRow[]
}

function timeAgo(iso: string): string {
  const diff    = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1)  return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours   < 24) return `${hours}h ago`
  const days  = Math.floor(hours / 24)
  if (days    < 7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function actionIcon(action: string) {
  if (action.startsWith('Logged'))              return Clock
  if (action === 'Tactic created')              return Plus
  if (action === 'Tactic updated')              return Pencil
  if (action.includes('In Progress'))           return RotateCcw
  return CheckCircle
}

export function ActivityTimeline({ logs }: Props) {
  if (logs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-neutral-400">No activity yet.</p>
    )
  }

  return (
    <div className="relative flex flex-col">
      <div className="absolute bottom-4 left-4 top-4 w-px bg-neutral-100" aria-hidden />
      {logs.map(log => {
        const Icon = actionIcon(log.action)
        return (
          <div key={log.id} className="relative flex gap-3 pb-5 last:pb-0">
            <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-neutral-200">
              <Icon className="h-3.5 w-3.5 text-neutral-500" />
            </div>

            <div className="min-w-0 flex-1 pt-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm text-neutral-800">
                  <span className="font-medium">{log.actor.full_name}</span>
                  {' '}
                  <span className="text-neutral-600">{log.action}</span>
                  {log.hours_logged != null && (
                    <span className="ml-1.5 inline-flex items-center rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                      {log.hours_logged}h
                    </span>
                  )}
                </p>
                <time className="shrink-0 text-xs text-neutral-400">{timeAgo(log.created_at)}</time>
              </div>
              {log.notes && (
                <p className="mt-1 text-sm italic text-neutral-500">{log.notes}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
