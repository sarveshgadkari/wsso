'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Pencil, CheckCircle2, RotateCcw,
  AlertTriangle, User, Calendar,
  MapPin, Users, FileText,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { RevisionModal } from './RevisionModal'
import { TacticSharePanel } from './TacticSharePanel'
import { approveTacticDocument, submitTacticDocument } from '@/lib/actions/tactic-documents'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export type TacticDocStatus = 'draft' | 'submitted' | 'reviewed' | 'approved' | 'revision_needed'

export interface TacticDocFull {
  id:             string
  code:           string
  date_of_meeting: string | null
  time_of_meeting: string | null
  facilitator:    string | null
  location:       string | null
  attendees:      string | null
  purpose:        string
  background_info: string | null
  takeaways:      string | null
  status:         TacticDocStatus
  reviewer_id:    string | null
  review_note:    string | null
  submitted_at:   string | null
  reviewed_at:    string | null
  created_by:     string
  created_at:     string
  creator:        { id: string; full_name: string; role: string; employee_code: string; manager_id?: string | null }
  reviewer:       { id: string; full_name: string; role: string } | null
  company:        { id: string; name: string; code: string } | null
  project:        { id: string; name: string; code: string } | null
  tasks: {
    id: string
    order_no: number
    title: string
    description: string
    status: 'pending' | 'in_progress' | 'completed'
    assigned_to: string | null
    owner_name: string | null
    target_date: string | null
    assignee: { full_name: string } | null
  }[]
  next_steps: {
    id: string
    order_no: number
    description: string
    owner: string | null
    owner_name: string | null
    due_date: string | null
    completed: boolean
    owner_profile: { full_name: string } | null
  }[]
}

interface Props {
  doc:         TacticDocFull
  currentUserId: string
  role:        string
  canReview?:  boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<TacticDocStatus, string> = {
  draft:           'Draft',
  submitted:       'Submitted — Awaiting Review',
  reviewed:        'Reviewed',
  approved:        'Approved',
  revision_needed: 'Revision Needed',
}

const STATUS_VARIANT: Record<TacticDocStatus, string> = {
  draft:           'default',
  submitted:       'info',
  reviewed:        'purple',
  approved:        'success',
  revision_needed: 'danger',
}

const TASK_STATUS_LABEL: Record<string, string> = {
  pending:     'Pending',
  in_progress: 'In Progress',
  completed:   'Completed',
}

const TASK_STATUS_VARIANT: Record<string, string> = {
  pending:     'default',
  in_progress: 'info',
  completed:   'success',
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso + 'T00:00:00').toLocaleDateString([], {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TacticDocumentDetail({
  doc, currentUserId, role, canReview = false,
}: Props) {
  const router  = useRouter()
  const isOwner = doc.created_by === currentUserId
  const isAdmin = role === 'admin'

  const [revisionOpen, setRevisionOpen] = useState(false)
  const [isPending, start] = useTransition()
  const [actionError, setActionError] = useState('')

  function handleApprove() {
    setActionError('')
    start(async () => {
      try {
        await approveTacticDocument(doc.id)
        router.refresh()
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  function handleSubmit() {
    setActionError('')
    start(async () => {
      try {
        await submitTacticDocument(doc.id)
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  const sectionHd = 'mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500 border-b border-neutral-200 pb-2'

  return (
    <>
      <div className="flex flex-col gap-6 pb-12">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link
              href="/tactic-documents"
              className="mt-1 flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
            >
              <ArrowLeft className="h-4 w-4" />
              TACTICs
            </Link>
            <span className="mt-1 text-neutral-300">/</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-bold text-primary-700">{doc.code}</span>
                <Badge variant={STATUS_VARIANT[doc.status] as never} className="text-xs">
                  {STATUS_LABEL[doc.status]}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-neutral-500">
                Created {fmtDateTime(doc.created_at)} by {doc.creator.full_name}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isOwner && doc.status === 'draft' && (
              <>
                <Button size="sm" onClick={handleSubmit} loading={isPending}>
                  Submit for Review
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => router.push(`/tactic-documents/${doc.id}/edit`)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </>
            )}
            {isOwner && doc.status === 'revision_needed' && (
              <Button
                size="sm"
                onClick={() => router.push(`/tactic-documents/${doc.id}/edit`)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit &amp; Re-submit
              </Button>
            )}
            {isAdmin && ['draft', 'revision_needed'].includes(doc.status) && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => router.push(`/tactic-documents/${doc.id}/edit`)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* ── Revision banner ─────────────────────────────────── */}
        {doc.status === 'revision_needed' && doc.review_note && (
          <div className="rounded-lg border border-warning-400 bg-warning-50 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-600" />
              <div>
                <p className="text-sm font-semibold text-warning-800">Revision Requested</p>
                <p className="mt-1 text-sm text-warning-700">{doc.review_note}</p>
                {doc.reviewer && (
                  <p className="mt-1 text-xs text-warning-600">
                    — {doc.reviewer.full_name} · {fmtDateTime(doc.reviewed_at)}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Review panel ────────────────────────────────────── */}
        {canReview && (
          <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
            <p className="text-sm font-semibold text-primary-800 mb-3">
              This TACTIC is waiting for your review.
            </p>
            {actionError && <p className="mb-2 text-sm text-danger-600">{actionError}</p>}
            <div className="flex gap-3">
              <Button size="sm" onClick={handleApprove} loading={isPending}>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setRevisionOpen(true)}
                disabled={isPending}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Request Revision
              </Button>
            </div>
          </div>
        )}

        <TacticSharePanel
          docId={doc.id}
          docCode={doc.code}
          isOwner={isOwner}
        />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">

          {/* ── DOCUMENT BODY ─────────────────────────────────── */}
          <div className="flex flex-col gap-6">

            {/* Meeting Details */}
            <div className="card p-6">
              <h3 className={sectionHd}>
                <FileText className="h-4 w-4" />
                Meeting Details
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <div>
                    <p className="text-xs text-neutral-400">Date &amp; Time</p>
                    <p className="text-sm text-neutral-800">
                      {fmtDate(doc.date_of_meeting)}
                      {doc.time_of_meeting && ` · ${doc.time_of_meeting}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <User className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <div>
                    <p className="text-xs text-neutral-400">Facilitator</p>
                    <p className="text-sm text-neutral-800">{doc.facilitator ?? '—'}</p>
                  </div>
                </div>
                {doc.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                    <div>
                      <p className="text-xs text-neutral-400">Location</p>
                      <p className="text-sm text-neutral-800">{doc.location}</p>
                    </div>
                  </div>
                )}
                {doc.attendees && (
                  <div className="flex items-start gap-3 sm:col-span-2">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                    <div>
                      <p className="text-xs text-neutral-400">Attendees</p>
                      <p className="text-sm text-neutral-800">{doc.attendees}</p>
                    </div>
                  </div>
                )}
                <div className="sm:col-span-2">
                  <p className="text-xs text-neutral-400 mb-1">Purpose</p>
                  <p className="text-sm font-semibold text-neutral-900">{doc.purpose}</p>
                </div>
              </div>
            </div>

            {/* TACTIC Tasks */}
            {doc.tasks.length > 0 && (
              <div className="card p-6">
                <h3 className={sectionHd}>
                  TACTIC Tasks
                </h3>
                <div className="flex flex-col gap-4">
                  {doc.tasks.map((task) => (
                    <div key={task.id} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                            {task.order_no}
                          </span>
                          <p className="font-semibold text-neutral-900">{task.title}</p>
                        </div>
                        <Badge variant={TASK_STATUS_VARIANT[task.status] as never} className="shrink-0 text-xs">
                          {TASK_STATUS_LABEL[task.status]}
                        </Badge>
                      </div>
                      <div className="ml-8 flex flex-wrap gap-4 text-xs text-neutral-500">
                        <span>
                          Owner:{' '}
                          <span className="font-medium text-neutral-700">
                            {task.assignee?.full_name ?? task.owner_name ?? '—'}
                          </span>
                        </span>
                        <span>
                          Target:{' '}
                          <span className="font-medium text-neutral-700">
                            {fmtDate(task.target_date)}
                          </span>
                        </span>
                      </div>
                      {task.description && (
                        <p className="ml-8 mt-2 text-sm text-neutral-600 whitespace-pre-wrap">
                          {task.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Background Info */}
            {doc.background_info && (
              <div className="card p-6">
                <h3 className={sectionHd}>Background Information</h3>
                <p className="whitespace-pre-wrap text-sm text-neutral-700">{doc.background_info}</p>
              </div>
            )}

            {/* Takeaways */}
            {doc.takeaways && (
              <div className="card p-6">
                <h3 className={sectionHd}>Takeaways</h3>
                <p className="whitespace-pre-wrap text-sm text-neutral-700">{doc.takeaways}</p>
              </div>
            )}

            {/* Next Steps */}
            {doc.next_steps.length > 0 && (
              <div className="card p-6">
                <h3 className={sectionHd}>Next Steps</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200">
                        <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">Task</th>
                        <th className="pb-2 px-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">Owner</th>
                        <th className="pb-2 px-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">Due Date</th>
                        <th className="pb-2 px-4 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {doc.next_steps.map(ns => (
                        <tr key={ns.id} className={cn(ns.completed && 'opacity-60')}>
                          <td className="py-3 pr-4">
                            <span className={cn('text-neutral-800', ns.completed && 'line-through')}>
                              {ns.description}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-neutral-600">
                            {ns.owner_profile?.full_name ?? ns.owner_name ?? '—'}
                          </td>
                          <td className="py-3 px-4 text-neutral-600 whitespace-nowrap">
                            {fmtDate(ns.due_date)}
                          </td>
                          <td className="py-3 px-4">
                            {ns.completed
                              ? <Badge variant="success" className="text-xs">Done</Badge>
                              : <Badge variant="default" className="text-xs">Open</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── SIDEBAR ───────────────────────────────────────── */}
          <aside className="flex flex-col gap-4">

            <div className="card p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Document Info
              </p>
              <dl className="flex flex-col gap-3 text-sm">
                <div>
                  <dt className="text-xs text-neutral-400">Created by</dt>
                  <dd className="font-medium text-neutral-800">{doc.creator.full_name}</dd>
                  <dd className="text-xs capitalize text-neutral-400">{doc.creator.role}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-400">Created</dt>
                  <dd className="text-neutral-700">{fmtDateTime(doc.created_at)}</dd>
                </div>
                {doc.submitted_at && (
                  <div>
                    <dt className="text-xs text-neutral-400">Submitted</dt>
                    <dd className="text-neutral-700">{fmtDateTime(doc.submitted_at)}</dd>
                  </div>
                )}
                {doc.reviewed_at && doc.reviewer && (
                  <div>
                    <dt className="text-xs text-neutral-400">Reviewed by</dt>
                    <dd className="font-medium text-neutral-800">{doc.reviewer.full_name}</dd>
                    <dd className="text-xs text-neutral-400">{fmtDateTime(doc.reviewed_at)}</dd>
                  </div>
                )}
                {doc.company && (
                  <div>
                    <dt className="text-xs text-neutral-400">Company</dt>
                    <dd className="text-neutral-700">{doc.company.name}</dd>
                  </div>
                )}
                {doc.project && (
                  <div>
                    <dt className="text-xs text-neutral-400">Project</dt>
                    <dd className="text-neutral-700">{doc.project.name}</dd>
                    <dd className="font-mono text-xs text-neutral-400">{doc.project.code}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Review status timeline */}
            <div className="card p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Review Timeline
              </p>
              <div className="flex flex-col gap-2">
                <ReviewStep
                  done={true}
                  label="Created"
                  sub={fmtDateTime(doc.created_at)}
                />
                <ReviewStep
                  done={!!doc.submitted_at}
                  label="Submitted for review"
                  sub={doc.submitted_at ? fmtDateTime(doc.submitted_at) : 'Not yet'}
                />
                <ReviewStep
                  done={['approved', 'reviewed', 'revision_needed'].includes(doc.status)}
                  label={doc.status === 'revision_needed' ? 'Revision requested' : 'Reviewed'}
                  sub={doc.reviewed_at ? fmtDateTime(doc.reviewed_at) : 'Awaiting reviewer'}
                  warn={doc.status === 'revision_needed'}
                />
                <ReviewStep
                  done={doc.status === 'approved'}
                  label="Approved"
                  sub={doc.status === 'approved' ? 'Completed' : 'Pending'}
                />
              </div>
            </div>
          </aside>
        </div>
      </div>

      <RevisionModal
        open={revisionOpen}
        docId={doc.id}
        docCode={doc.code}
        onClose={() => setRevisionOpen(false)}
      />
    </>
  )
}

function ReviewStep({
  done, label, sub, warn,
}: { done: boolean; label: string; sub: string; warn?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <div className={cn(
        'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px]',
        done
          ? warn
            ? 'bg-warning-100 text-warning-700'
            : 'bg-success-100 text-success-700'
          : 'bg-neutral-100 text-neutral-400',
      )}>
        {done ? (warn ? '!' : '✓') : '○'}
      </div>
      <div>
        <p className="text-xs font-medium text-neutral-700">{label}</p>
        <p className="text-[11px] text-neutral-400">{sub}</p>
      </div>
    </div>
  )
}
