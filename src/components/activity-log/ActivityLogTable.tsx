'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Pencil, CheckCircle2, Play, Eye, Archive,
  RefreshCcw, Clock, LogOut, Activity, Search,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import type { LucideIcon } from 'lucide-react'

export interface ActivityLogEntry {
  id:           string
  tactic_id:    string | null
  employee_id:  string
  action:       string
  hours_logged: number | null
  notes:        string | null
  meta:         Record<string, unknown> | null
  created_at:   string
  actor:        { id: string; full_name: string; employee_code: string } | null
  tactic:       { id: string; code: string; title: string } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function fmtAbsolute(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

interface ActionStyle { icon: LucideIcon; bg: string; fg: string }

function getActionStyle(action: string): ActionStyle {
  if (action === 'Tactic created')                   return { icon: Plus,        bg: 'bg-primary-50',  fg: 'text-primary-600' }
  if (action === 'Tactic updated')                   return { icon: Pencil,      bg: 'bg-neutral-100', fg: 'text-neutral-500' }
  if (action.startsWith('Status changed to Done'))   return { icon: CheckCircle2,bg: 'bg-success-50',  fg: 'text-success-600' }
  if (action.startsWith('Status changed to In'))     return { icon: Play,        bg: 'bg-primary-50',  fg: 'text-primary-600' }
  if (action.startsWith('Status changed to Review')) return { icon: Eye,         bg: 'bg-warning-50',  fg: 'text-warning-600' }
  if (action.startsWith('Status changed to Arch'))   return { icon: Archive,     bg: 'bg-neutral-100', fg: 'text-neutral-500' }
  if (action.startsWith('Status changed to'))        return { icon: RefreshCcw,  bg: 'bg-neutral-100', fg: 'text-neutral-500' }
  if (action.startsWith('Logged'))                   return { icon: Clock,       bg: 'bg-purple-50',   fg: 'text-purple-600'  }
  if (action.startsWith('time_log'))                 return { icon: LogOut,      bg: 'bg-danger-50',   fg: 'text-danger-600'  }
  return { icon: Activity, bg: 'bg-neutral-100', fg: 'text-neutral-500' }
}

function formatDescription(
  action: string,
  tactic: { code: string; title: string } | null,
  meta: Record<string, unknown> | null,
): string {
  const code = tactic?.code ?? '—'

  if (action === 'Tactic created') return `Created ${code}: ${tactic?.title ?? ''}`
  if (action === 'Tactic updated') return `Updated ${code}`

  const statusMatch = action.match(/^Status changed to (.+)$/)
  if (statusMatch) return `Marked ${code} as ${statusMatch[1]}`

  const hoursMatch = action.match(/^Logged (.+)h$/)
  if (hoursMatch) return `Logged ${hoursMatch[1]}h on ${code}`

  if (action === 'time_log.force_closed') {
    const by = typeof meta?.closed_by_name === 'string' ? ` by ${meta.closed_by_name}` : ''
    return `Time session force-closed${by}`
  }

  return action
}

// ── Table component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 50

interface Props {
  logs: ActivityLogEntry[]
}

export function ActivityLogTable({ logs: allLogs }: Props) {
  const router = useRouter()
  const [tacticSearch, setTacticSearch] = useState('')
  const [page, setPage] = useState(1)

  // Filter by tactic code (client-side)
  const filtered = tacticSearch.trim()
    ? allLogs.filter((l) =>
        l.tactic?.code.toLowerCase().includes(tacticSearch.toLowerCase()),
      )
    : allLogs

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safeP      = Math.min(page, totalPages)
  const start      = (safeP - 1) * PAGE_SIZE
  const rows       = filtered.slice(start, start + PAGE_SIZE)

  // Reset to page 1 when parent logs change or search changes
  useEffect(() => { setPage(1) }, [allLogs, tacticSearch])

  return (
    <div className="flex flex-col gap-4">
      {/* Tactic code search */}
      <div className="relative w-56">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-neutral-400" />
        <input
          placeholder="Filter tactic (TAC-015)…"
          value={tacticSearch}
          onChange={(e) => setTacticSearch(e.target.value)}
          className="h-9 w-full rounded border border-neutral-300 bg-white pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <tr>
                {['', 'Actor', 'Description', 'Tactic', 'When'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-neutral-400">
                    {allLogs.length === 0
                      ? 'No activity in this date range.'
                      : 'No matches for this tactic code.'}
                  </td>
                </tr>
              ) : (
                rows.map((log) => {
                  const style = getActionStyle(log.action)
                  const Icon  = style.icon
                  const desc  = formatDescription(log.action, log.tactic, log.meta)
                  const canNav = !!log.tactic

                  return (
                    <tr
                      key={log.id}
                      onClick={() => canNav && router.push(`/tactics/${log.tactic!.id}`)}
                      className={cn(
                        'transition-colors hover:bg-neutral-50/70',
                        canNav && 'cursor-pointer',
                      )}
                    >
                      {/* Icon */}
                      <td className="px-4 py-3">
                        <div className={cn(
                          'flex h-7 w-7 items-center justify-center rounded-full',
                          style.bg,
                        )}>
                          <Icon className={cn('h-3.5 w-3.5', style.fg)} />
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="px-4 py-3">
                        {log.actor ? (
                          <div>
                            <p className="font-medium text-neutral-900 whitespace-nowrap">
                              {log.actor.full_name}
                            </p>
                            <p className="font-mono text-[11px] text-neutral-400">
                              {log.actor.employee_code}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-neutral-400">—</span>
                        )}
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3">
                        <p className="text-neutral-700">{desc}</p>
                        {log.notes && (
                          <p className="mt-0.5 text-xs italic text-neutral-400 line-clamp-1">
                            {log.notes}
                          </p>
                        )}
                      </td>

                      {/* Tactic entity */}
                      <td className="px-4 py-3">
                        {log.tactic ? (
                          <span
                            onClick={(e) => {
                              e.stopPropagation()
                              router.push(`/tactics/${log.tactic!.id}`)
                            }}
                            className="inline-flex cursor-pointer items-center rounded-full border border-primary-200 bg-primary-50 px-2.5 py-0.5 font-mono text-xs font-medium text-primary-700 hover:bg-primary-100 transition-colors whitespace-nowrap"
                          >
                            {log.tactic.code}
                          </span>
                        ) : (
                          <span className="text-xs text-neutral-300">—</span>
                        )}
                      </td>

                      {/* Timestamp */}
                      <td className="px-4 py-3">
                        <time
                          dateTime={log.created_at}
                          title={fmtAbsolute(log.created_at)}
                          className="whitespace-nowrap text-xs text-neutral-400"
                        >
                          {timeAgo(log.created_at)}
                        </time>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer: count + pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-400">
          {filtered.length === allLogs.length
            ? `${allLogs.length} records`
            : `${filtered.length} of ${allLogs.length} records`}
        </p>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safeP === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs text-neutral-600">
              {safeP} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeP === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
