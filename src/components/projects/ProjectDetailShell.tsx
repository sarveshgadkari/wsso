'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Building2, User, Briefcase, Calendar, Pencil, ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ProjectDialog, type ProjectRow } from './ProjectDialog'
import {
  STATUS_LABEL as TACTIC_STATUS_LABEL,
  STATUS_VARIANT as TACTIC_STATUS_VARIANT,
  PRIORITY_LABEL as TACTIC_PRIORITY_LABEL,
  PRIORITY_VARIANT as TACTIC_PRIORITY_VARIANT,
} from '@/lib/tactics-utils'
import type { Company, Client, Profile, TacticStatus, TacticPriority } from '@/lib/types'
import type { TacticRow } from '@/components/tactics/TacticDialog'

const STATUS_VARIANT = {
  active:    'success',
  on_hold:   'warning',
  completed: 'default',
} as const

const STATUS_LABEL = {
  active:    'Active',
  on_hold:   'On hold',
  completed: 'Completed',
} as const

interface Props {
  project:   ProjectRow
  companies: Pick<Company, 'id' | 'name' | 'code'>[]
  clients:   (Pick<Client,  'id' | 'name' | 'code'> & { company_id: string })[]
  managers:  Pick<Profile,  'id' | 'full_name' | 'employee_code'>[]
  isAdmin:   boolean
  canEdit:   boolean
  currentUserId: string
  tactics:   TacticRow[]
}

function MetaItem({
  icon: Icon,
  label,
  children,
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

export function ProjectDetailShell({
  project, companies, clients, managers, isAdmin, canEdit, currentUserId, tactics,
}: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen]   = useState(false)
  const [current,  setCurrent]    = useState<ProjectRow>(project)

  const status = current.status as keyof typeof STATUS_VARIANT

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/projects"
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Projects
          </Link>
          <span className="text-neutral-300">/</span>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">{current.name}</h2>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="font-mono text-xs text-neutral-400">{current.code}</span>
              <Badge variant={STATUS_VARIANT[status] ?? 'default'}>
                {STATUS_LABEL[status] ?? status}
              </Badge>
            </div>
          </div>
        </div>

        {canEdit && (
          <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit project
          </Button>
        )}
      </div>

      {/* Details card */}
      <div className="card p-6">
        <h3 className="mb-4 text-sm font-semibold text-neutral-800">Project details</h3>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <MetaItem icon={Building2} label="Company">
            {current.company ? (
              <span>
                <span className="font-mono text-xs text-neutral-400 mr-1.5">
                  {current.company.code}
                </span>
                {current.company.name}
              </span>
            ) : (
              <span className="text-neutral-400">—</span>
            )}
          </MetaItem>

          <MetaItem icon={Briefcase} label="Client">
            {current.client ? (
              <span>
                <span className="font-mono text-xs text-neutral-400 mr-1.5">
                  {current.client.code}
                </span>
                {current.client.name}
              </span>
            ) : (
              <span className="text-neutral-400">No client linked</span>
            )}
          </MetaItem>

          <MetaItem icon={User} label="Manager">
            {current.manager ? (
              <span>
                {current.manager.full_name}
                <span className="font-mono ml-1.5 text-xs text-neutral-400">
                  ({current.manager.employee_code})
                </span>
              </span>
            ) : (
              <span className="text-neutral-400">Unassigned</span>
            )}
          </MetaItem>

          <MetaItem icon={Calendar} label="Created">
            {new Date(current.created_at).toLocaleDateString([], {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </MetaItem>
        </div>
      </div>

      {/* Tasks */}
      <div className="card">
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-neutral-400" />
            <span className="text-sm font-semibold text-neutral-700">Tasks</span>
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-100 px-1.5 text-xs font-medium text-neutral-500">
              {tactics.length}
            </span>
          </div>
          <Link href={`/tactics?project=${current.id}`} className="text-xs text-primary-600 hover:underline">
            View all in Tactics →
          </Link>
        </div>
        {tactics.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <ClipboardList className="h-8 w-8 text-neutral-200" />
            <p className="text-sm text-neutral-400">No tactics linked to this project yet.</p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {tactics.map(t => (
              <li key={t.id}>
                <Link
                  href={`/tactics/${t.id}`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50 transition-colors"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 font-mono text-xs text-neutral-400">{t.code}</span>
                    <span className="truncate text-sm font-medium text-neutral-800">{t.title}</span>
                    <span className="hidden shrink-0 text-xs text-neutral-400 sm:block">
                      {t.assignee?.full_name ?? 'Unknown'}
                    </span>
                  </div>
                  <div className="ml-3 flex shrink-0 items-center gap-2">
                    <Badge variant={TACTIC_PRIORITY_VARIANT[t.priority as TacticPriority]}>
                      {TACTIC_PRIORITY_LABEL[t.priority as TacticPriority]}
                    </Badge>
                    <Badge variant={TACTIC_STATUS_VARIANT[t.status as TacticStatus]}>
                      {TACTIC_STATUS_LABEL[t.status as TacticStatus]}
                    </Badge>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Edit dialog */}
      {canEdit && (
        <ProjectDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setCurrent(updated)
            setEditOpen(false)
            router.refresh()
          }}
          project={current}
          companies={companies}
          clients={clients}
          managers={managers}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
        />
      )}
    </div>
  )
}
