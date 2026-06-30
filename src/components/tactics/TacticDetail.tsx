'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, User, Briefcase, Calendar, Clock, Flag } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { TacticDialog, type TacticRow, type EmployeeOption, type ProjectOption } from './TacticDialog'
import { TacticStatusButtons } from './TacticStatusButtons'
import { HoursLogDialog } from './HoursLogDialog'
import { ActivityTimeline, type ActivityLogRow } from './ActivityTimeline'
import { STATUS_LABEL, STATUS_VARIANT, PRIORITY_LABEL, PRIORITY_VARIANT } from '@/lib/tactics-utils'
import type { TacticStatus, TacticPriority, UserRole } from '@/lib/types'

interface Props {
  tactic:        TacticRow
  logs:          ActivityLogRow[]
  employees:     EmployeeOption[]
  projects:      ProjectOption[]
  role:          UserRole
  canEdit:       boolean
  currentUserId: string
}

function MetaItem({
  icon: Icon, label, children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
        <Icon className="h-4 w-4 text-neutral-500" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">{label}</p>
        <div className="mt-0.5 text-sm text-neutral-800">{children}</div>
      </div>
    </div>
  )
}

export function TacticDetail({
  tactic: initialTactic, logs, employees, projects, role, canEdit, currentUserId,
}: Props) {
  const router = useRouter()
  const [tactic,   setTactic]   = useState<TacticRow>(initialTactic)
  const [editOpen, setEditOpen] = useState(false)

  const status   = tactic.status   as TacticStatus
  const priority = tactic.priority as TacticPriority

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/tactics" className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700">
            <ArrowLeft className="h-4 w-4" />
            Tactics
          </Link>
          <span className="mt-1 text-neutral-300">/</span>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">{tactic.title}</h2>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="font-mono text-xs text-neutral-400">{tactic.code}</span>
              <Badge variant={PRIORITY_VARIANT[priority]}>{PRIORITY_LABEL[priority]}</Badge>
              <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <HoursLogDialog
            tacticId={tactic.id}
            onLogged={() => router.refresh()}
          />
          {canEdit && (
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>
      </div>

      {/* Description */}
      {tactic.description && (
        <div className="card p-4">
          <p className="whitespace-pre-wrap text-sm text-neutral-700">{tactic.description}</p>
        </div>
      )}

      {/* Status actions */}
      <div className="card p-4">
        <h3 className="mb-3 text-sm font-semibold text-neutral-700">Next action</h3>
        <TacticStatusButtons
          tacticId={tactic.id}
          currentStatus={status}
          role={role}
          onTransitioned={newStatus => setTactic(prev => ({ ...prev, status: newStatus }))}
        />
        {status === 'archived' && (
          <p className="text-sm text-neutral-400">This tactic has been archived.</p>
        )}
        {getAllowedNextLength(status, role) === 0 && status !== 'archived' && (
          <p className="text-sm text-neutral-400">No actions available for your role on this status.</p>
        )}
      </div>

      {/* Details */}
      <div className="card p-6">
        <h3 className="mb-4 text-sm font-semibold text-neutral-800">Details</h3>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <MetaItem icon={User} label="Assigned to">
            {tactic.assignee.full_name}
            <span className="ml-1.5 font-mono text-xs text-neutral-400">
              ({tactic.assignee.employee_code})
            </span>
          </MetaItem>

          <MetaItem icon={Briefcase} label="Project">
            {tactic.project ? (
              <Link href={`/projects/${tactic.project_id}`} className="text-primary-600 hover:underline">
                {tactic.project.name}
              </Link>
            ) : (
              <span className="text-neutral-400">No project</span>
            )}
          </MetaItem>

          <MetaItem icon={Calendar} label="Due date">
            {tactic.due_date
              ? new Date(tactic.due_date + 'T00:00:00').toLocaleDateString([], {
                  year: 'numeric', month: 'long', day: 'numeric',
                })
              : <span className="text-neutral-400">No due date</span>}
          </MetaItem>

          <MetaItem icon={Clock} label="Estimated hours">
            {tactic.estimated_hours != null
              ? `${tactic.estimated_hours}h`
              : <span className="text-neutral-400">—</span>}
          </MetaItem>

          <MetaItem icon={Flag} label="Created by">
            {tactic.creator.full_name}
          </MetaItem>
        </div>
      </div>

      {/* Activity timeline */}
      <div className="card p-6">
        <h3 className="mb-4 text-sm font-semibold text-neutral-800">Activity</h3>
        <ActivityTimeline logs={logs} />
      </div>

      {/* Edit dialog */}
      {canEdit && (
        <TacticDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={updated => { setTactic(updated); setEditOpen(false); router.refresh() }}
          tactic={tactic}
          employees={employees}
          projects={projects}
          isAdmin={role === 'admin'}
          currentUserId={currentUserId}
        />
      )}
    </div>
  )
}

// Helper to avoid importing server action in this client component
function getAllowedNextLength(status: TacticStatus, role: string): number {
  if (role === 'admin' || role === 'manager') {
    const map: Record<TacticStatus, number> = {
      assigned: 1, in_progress: 1, review: 2, done: 1, archived: 0,
    }
    return map[status] ?? 0
  }
  const map: Record<TacticStatus, number> = {
    assigned: 1, in_progress: 1, review: 0, done: 0, archived: 0,
  }
  return map[status] ?? 0
}
