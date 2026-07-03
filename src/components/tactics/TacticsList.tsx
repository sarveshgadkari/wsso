'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { TacticDialog, type TacticRow, type EmployeeOption, type ProjectOption } from './TacticDialog'
import {
  STATUS_LABEL, STATUS_VARIANT,
  PRIORITY_LABEL, PRIORITY_VARIANT,
} from '@/lib/tactics-utils'
import type { TacticStatus, TacticPriority } from '@/lib/types'

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

interface Props {
  initialTactics: TacticRow[]
  employees:      EmployeeOption[]
  projects:       ProjectOption[]
  isAdmin:        boolean
  isManager:      boolean
  currentUserId:  string
}

const selectCls =
  'h-8 rounded border border-neutral-300 bg-white px-2 text-sm text-neutral-700 ' +
  'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500'

export function TacticsList({
  initialTactics, employees, projects, isAdmin, isManager, currentUserId,
}: Props) {
  const router     = useRouter()
  const canCreate  = isAdmin || isManager
  const [tactics,    setTactics]    = useState<TacticRow[]>(initialTactics)
  const [createOpen, setCreateOpen] = useState(false)
  const [search,     setSearch]     = useState('')
  const [statusF,    setStatusF]    = useState<TacticStatus | ''>('')
  const [priorityF,  setPriorityF]  = useState<TacticPriority | ''>('')
  const [projectF,   setProjectF]   = useState('')
  const [assigneeF,  setAssigneeF]  = useState('')
  const [myTasks,    setMyTasks]    = useState(false)

  const today = todayStr()

  const filtered = useMemo(() => {
    return tactics.filter(t => {
      if (myTasks    && t.assigned_to !== currentUserId) return false
      if (statusF    && t.status      !== statusF)       return false
      if (priorityF  && t.priority    !== priorityF)     return false
      if (projectF   && t.project_id  !== projectF)      return false
      if (assigneeF  && t.assigned_to !== assigneeF)     return false
      if (search) {
        const q = search.toLowerCase()
        return t.title.toLowerCase().includes(q) || t.code.toLowerCase().includes(q)
      }
      return true
    })
  }, [tactics, myTasks, statusF, priorityF, projectF, assigneeF, search, currentUserId])

  function rowBg(t: TacticRow) {
    if (!t.due_date || t.status === 'done' || t.status === 'archived') return ''
    if (t.due_date < today)   return 'bg-red-50 hover:bg-red-100'
    if (t.due_date === today)  return 'bg-amber-50 hover:bg-amber-100'
    return ''
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <Input
            placeholder="Search title or code…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>

        <select value={statusF} onChange={e => setStatusF(e.target.value as TacticStatus | '')} className={selectCls}>
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABEL) as TacticStatus[]).map(v => (
            <option key={v} value={v}>{STATUS_LABEL[v]}</option>
          ))}
        </select>

        <select value={priorityF} onChange={e => setPriorityF(e.target.value as TacticPriority | '')} className={selectCls}>
          <option value="">All priorities</option>
          {(Object.keys(PRIORITY_LABEL) as TacticPriority[]).map(v => (
            <option key={v} value={v}>{PRIORITY_LABEL[v]}</option>
          ))}
        </select>

        {projects.length > 0 && (
          <select value={projectF} onChange={e => setProjectF(e.target.value)} className={selectCls}>
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}

        {(isAdmin || isManager) && employees.length > 0 && (
          <select value={assigneeF} onChange={e => setAssigneeF(e.target.value)} className={selectCls}>
            <option value="">All assignees</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        )}

        <Button
          size="sm"
          variant={myTasks ? 'primary' : 'secondary'}
          onClick={() => setMyTasks(v => !v)}
        >
          My Tasks
        </Button>

        {canCreate && (
          <Button size="sm" className="ml-auto" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            New Work Order
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-100">
            <thead className="bg-neutral-50">
              <tr>
                {['Code', 'Title', 'Priority', 'Assignee', 'Project', 'Status', 'Due', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-neutral-400">
                    No work orders match the current filters.
                  </td>
                </tr>
              ) : (
                filtered.map(t => {
                  const isOverdue  = t.due_date && t.due_date < today  && t.status !== 'done' && t.status !== 'archived'
                  const isDueToday = t.due_date && t.due_date === today && t.status !== 'done' && t.status !== 'archived'
                  return (
                    <tr
                      key={t.id}
                      className={cn('cursor-pointer transition-colors hover:bg-neutral-50', rowBg(t))}
                      onClick={() => router.push(`/tactics/${t.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-neutral-400">{t.code}</td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="truncate text-sm font-medium text-neutral-800">{t.title}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={PRIORITY_VARIANT[t.priority as TacticPriority]}>
                          {PRIORITY_LABEL[t.priority as TacticPriority]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-700">
                        {t.assignee?.full_name ?? 'Unknown'}
                      </td>
                      <td className="px-4 py-3 text-sm text-neutral-500">
                        {t.project?.name ?? <span className="text-neutral-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[t.status as TacticStatus]}>
                          {STATUS_LABEL[t.status as TacticStatus]}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {t.due_date ? (
                          <span className={cn(
                            'flex items-center gap-1',
                            isOverdue  ? 'font-medium text-red-600'
                            : isDueToday ? 'font-medium text-amber-600'
                            : 'text-neutral-600',
                          )}>
                            {isOverdue && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                            {new Date(t.due_date + 'T00:00:00').toLocaleDateString([], {
                              month: 'short', day: 'numeric',
                            })}
                          </span>
                        ) : (
                          <span className="text-neutral-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={e => { e.stopPropagation(); router.push(`/tactics/${t.id}`) }}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {canCreate && (
        <TacticDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSaved={newT => { setTactics(prev => [newT, ...prev]); setCreateOpen(false) }}
          employees={employees}
          projects={projects}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
        />
      )}
    </div>
  )
}
