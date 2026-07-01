'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createTacticDocument, updateTacticDocument } from '@/lib/actions/tactic-documents'
import type { TacticDocumentInput, TaskInput, NextStepInput } from '@/lib/actions/tactic-documents'

// ── Local draft types ─────────────────────────────────────────────────────────

interface TaskDraft {
  _key: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  assigned_to: string
  owner_name: string
  target_date: string
}

interface NextStepDraft {
  _key: string
  description: string
  owner: string
  owner_name: string
  due_date: string
}

function uuid() {
  return Math.random().toString(36).slice(2)
}

function emptyTask(): TaskDraft {
  return {
    _key: uuid(),
    title: '',
    description: '',
    status: 'pending',
    assigned_to: '',
    owner_name: '',
    target_date: '',
  }
}

function emptyStep(): NextStepDraft {
  return {
    _key: uuid(),
    description: '',
    owner: '',
    owner_name: '',
    due_date: '',
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

type EmployeeOption = { id: string; full_name: string; employee_code: string }
type CompanyOption  = { id: string; name: string; code: string }
type ProjectOption  = { id: string; name: string; code: string }

interface InitialDoc {
  id: string
  code: string
  date_of_meeting: string | null
  time_of_meeting: string | null
  facilitator: string | null
  location: string | null
  attendees: string | null
  purpose: string
  background_info: string | null
  takeaways: string | null
  company_id: string | null
  project_id: string | null
  tactic_id: string | null
  status: string
  tasks: {
    _key: string
    title: string
    description: string
    status: 'pending' | 'in_progress' | 'completed'
    assigned_to: string | null
    owner_name: string | null
    target_date: string | null
    order_no: number
  }[]
  next_steps: {
    _key: string
    description: string
    owner: string | null
    owner_name: string | null
    due_date: string | null
    order_no: number
  }[]
}

interface Props {
  employees:       EmployeeOption[]
  companies:       CompanyOption[]
  projects:        ProjectOption[]
  currentUserName: string
  initialDoc?:     InitialDoc
}

// ── Styles ────────────────────────────────────────────────────────────────────

const sectionCls = 'card p-6 flex flex-col gap-4'
const labelCls   = 'text-xs font-semibold uppercase tracking-wider text-neutral-500'
const inputCls   =
  'h-9 w-full rounded border border-neutral-300 bg-white px-3 text-sm text-neutral-900 ' +
  'placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500'
const textareaCls =
  'w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 resize-none ' +
  'placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500'
const selectCls  =
  'h-9 w-full rounded border border-neutral-300 bg-white px-3 text-sm text-neutral-900 ' +
  'focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500'

// ── Component ─────────────────────────────────────────────────────────────────

export function TacticDocumentForm({
  employees, companies, projects, currentUserName, initialDoc,
}: Props) {
  const router    = useRouter()
  const isEdit    = !!initialDoc
  const isRevision = initialDoc?.status === 'revision_needed'

  // Static fields
  const [dateOfMeeting, setDateOfMeeting] = useState(initialDoc?.date_of_meeting ?? '')
  const [timeOfMeeting, setTimeOfMeeting] = useState(initialDoc?.time_of_meeting ?? '')
  const [facilitator,   setFacilitator]   = useState(initialDoc?.facilitator ?? currentUserName)
  const [location,      setLocation]      = useState(initialDoc?.location ?? '')
  const [attendees,     setAttendees]     = useState(initialDoc?.attendees ?? '')
  const [purpose,       setPurpose]       = useState(initialDoc?.purpose ?? '')
  const [backgroundInfo, setBackgroundInfo] = useState(initialDoc?.background_info ?? '')
  const [takeaways,     setTakeaways]     = useState(initialDoc?.takeaways ?? '')
  const [companyId,     setCompanyId]     = useState(initialDoc?.company_id ?? '')
  const [projectId,     setProjectId]     = useState(initialDoc?.project_id ?? '')
  const [tacticId]      = useState(initialDoc?.tactic_id ?? '')

  // Dynamic lists
  const [tasks, setTasks] = useState<TaskDraft[]>(
    initialDoc?.tasks.length
      ? initialDoc.tasks.map(t => ({
          _key:        uuid(),
          title:       t.title,
          description: t.description,
          status:      t.status,
          assigned_to: t.assigned_to ?? '',
          owner_name:  t.owner_name  ?? '',
          target_date: t.target_date ?? '',
        }))
      : [emptyTask()],
  )

  const [nextSteps, setNextSteps] = useState<NextStepDraft[]>(
    initialDoc?.next_steps.length
      ? initialDoc.next_steps.map(ns => ({
          _key:        uuid(),
          description: ns.description,
          owner:       ns.owner      ?? '',
          owner_name:  ns.owner_name ?? '',
          due_date:    ns.due_date   ?? '',
        }))
      : [],
  )

  const [error,    setError]    = useState('')
  const [isPending, startTransition] = useTransition()

  // ── Task helpers ────────────────────────────────────────────

  function updateTask(key: string, patch: Partial<TaskDraft>) {
    setTasks(prev => prev.map(t => t._key === key ? { ...t, ...patch } : t))
  }

  function removeTask(key: string) {
    setTasks(prev => prev.filter(t => t._key !== key))
  }

  function moveTask(key: string, dir: -1 | 1) {
    setTasks(prev => {
      const idx = prev.findIndex(t => t._key === key)
      if (idx < 0) return prev
      const next = [...prev]
      const swap = idx + dir
      if (swap < 0 || swap >= next.length) return prev
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
  }

  // ── Next step helpers ───────────────────────────────────────

  function updateStep(key: string, patch: Partial<NextStepDraft>) {
    setNextSteps(prev => prev.map(ns => ns._key === key ? { ...ns, ...patch } : ns))
  }

  function removeStep(key: string) {
    setNextSteps(prev => prev.filter(ns => ns._key !== key))
  }

  // ── Submission ───────────────────────────────────────────────

  function buildInput(): TacticDocumentInput {
    return {
      date_of_meeting: dateOfMeeting,
      time_of_meeting: timeOfMeeting,
      facilitator,
      location,
      attendees,
      purpose,
      background_info: backgroundInfo,
      takeaways,
      company_id: companyId,
      project_id: projectId,
      tactic_id:  tacticId,
      tasks: tasks.map((t, i): TaskInput => ({
        title:       t.title,
        description: t.description,
        status:      t.status,
        assigned_to: t.assigned_to || null,
        owner_name:  t.owner_name  || null,
        target_date: t.target_date || null,
        order_no:    i + 1,
      })),
      next_steps: nextSteps.map((ns, i): NextStepInput => ({
        description: ns.description,
        owner:       ns.owner      || null,
        owner_name:  ns.owner_name || null,
        due_date:    ns.due_date   || null,
        order_no:    i + 1,
      })),
    }
  }

  function validate(): string {
    if (!purpose.trim())       return 'Purpose is required.'
    if (tasks.length === 0)    return 'At least one TACTIC task is required.'
    if (tasks.some(t => !t.title.trim())) return 'All tasks must have a title.'
    if (nextSteps.some(ns => !ns.description.trim()))
      return 'All next steps must have a description.'
    return ''
  }

  function handleSubmit(submitForReview: boolean) {
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setError('')

    startTransition(async () => {
      try {
        const input = buildInput()
        if (isEdit && initialDoc) {
          await updateTacticDocument(initialDoc.id, input, submitForReview)
          router.push(`/tactic-documents/${initialDoc.id}`)
        } else {
          const doc = await createTacticDocument(input, submitForReview)
          router.push(`/tactic-documents/${doc.id}`)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">

      {/* SECTION 1 — Meeting Details */}
      <section className={sectionCls}>
        <h3 className="text-base font-semibold text-neutral-800">Meeting Details</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Date of Meeting *</label>
            <input
              type="date"
              value={dateOfMeeting}
              onChange={e => setDateOfMeeting(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Time of Meeting</label>
            <input
              type="text"
              placeholder="e.g. 6:00 PM IST"
              value={timeOfMeeting}
              onChange={e => setTimeOfMeeting(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Facilitator</label>
            <input
              type="text"
              placeholder="Meeting facilitator"
              value={facilitator}
              onChange={e => setFacilitator(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className={labelCls}>Location</label>
            <input
              type="text"
              placeholder="e.g. Zoom Call, In Person"
              value={location}
              onChange={e => setLocation(e.target.value)}
              className={inputCls}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelCls}>Attendees</label>
          <input
            type="text"
            placeholder="Comma-separated names"
            value={attendees}
            onChange={e => setAttendees(e.target.value)}
            className={inputCls}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className={labelCls}>Purpose *</label>
          <textarea
            rows={3}
            placeholder="What was the meeting about?"
            value={purpose}
            onChange={e => setPurpose(e.target.value)}
            className={textareaCls}
          />
        </div>
      </section>

      {/* SECTION 2 — TACTIC Tasks */}
      <section className={sectionCls}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-800">TACTIC Tasks</h3>
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={() => setTasks(prev => [...prev, emptyTask()])}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Task
          </Button>
        </div>

        {tasks.length === 0 && (
          <p className="text-sm text-neutral-400">No tasks yet. Click &quot;Add Task&quot; to begin.</p>
        )}

        <div className="flex flex-col gap-4">
          {tasks.map((task, idx) => (
            <div key={task._key} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                  {idx + 1}
                </span>
                <div className="flex items-center gap-1 ml-auto">
                  <button
                    type="button"
                    onClick={() => moveTask(task._key, -1)}
                    disabled={idx === 0}
                    className="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveTask(task._key, 1)}
                    disabled={idx === tasks.length - 1}
                    className="rounded p-0.5 text-neutral-400 hover:bg-neutral-200 disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeTask(task._key)}
                    className="rounded p-0.5 text-danger-400 hover:bg-danger-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className={labelCls}>Task Title *</label>
                  <input
                    type="text"
                    placeholder="What needs to happen"
                    value={task.title}
                    onChange={e => updateTask(task._key, { title: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Status</label>
                  <select
                    value={task.status}
                    onChange={e => updateTask(task._key, { status: e.target.value as TaskDraft['status'] })}
                    className={selectCls}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Target Date</label>
                  <input
                    type="date"
                    value={task.target_date}
                    onChange={e => updateTask(task._key, { target_date: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Owner (Employee)</label>
                  <select
                    value={task.assigned_to}
                    onChange={e => updateTask(task._key, { assigned_to: e.target.value })}
                    className={selectCls}
                  >
                    <option value="">— Select employee —</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>
                        {e.full_name} ({e.employee_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className={labelCls}>Or External Owner</label>
                  <input
                    type="text"
                    placeholder="Name of external owner"
                    value={task.owner_name}
                    onChange={e => updateTask(task._key, { owner_name: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div className="flex flex-col gap-1 sm:col-span-2">
                  <label className={labelCls}>Description</label>
                  <textarea
                    rows={2}
                    placeholder="What needs to get done…"
                    value={task.description}
                    onChange={e => updateTask(task._key, { description: e.target.value })}
                    className={textareaCls}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION 3 — Background Info */}
      <section className={sectionCls}>
        <h3 className="text-base font-semibold text-neutral-800">Background Information</h3>
        <textarea
          rows={5}
          placeholder="Context, domain info, strategic value…"
          value={backgroundInfo}
          onChange={e => setBackgroundInfo(e.target.value)}
          className={textareaCls}
        />
      </section>

      {/* SECTION 4 — Takeaways */}
      <section className={sectionCls}>
        <h3 className="text-base font-semibold text-neutral-800">Takeaways</h3>
        <textarea
          rows={4}
          placeholder="Key decisions and conclusions from the meeting…"
          value={takeaways}
          onChange={e => setTakeaways(e.target.value)}
          className={textareaCls}
        />
      </section>

      {/* SECTION 5 — Next Steps */}
      <section className={sectionCls}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-neutral-800">Next Steps</h3>
          <Button
            size="sm"
            variant="secondary"
            type="button"
            onClick={() => setNextSteps(prev => [...prev, emptyStep()])}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Row
          </Button>
        </div>

        {nextSteps.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  <th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">Task</th>
                  <th className="pb-2 px-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">Owner</th>
                  <th className="pb-2 px-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-400">Due Date</th>
                  <th className="pb-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {nextSteps.map(ns => (
                  <tr key={ns._key}>
                    <td className="py-2 pr-3">
                      <input
                        type="text"
                        placeholder="Action to take…"
                        value={ns.description}
                        onChange={e => updateStep(ns._key, { description: e.target.value })}
                        className={inputCls}
                      />
                    </td>
                    <td className="py-2 px-3 min-w-[200px]">
                      <select
                        value={ns.owner}
                        onChange={e => updateStep(ns._key, { owner: e.target.value, owner_name: '' })}
                        className={selectCls}
                      >
                        <option value="">— Employee —</option>
                        {employees.map(e => (
                          <option key={e.id} value={e.id}>
                            {e.full_name}
                          </option>
                        ))}
                      </select>
                      {!ns.owner && (
                        <input
                          type="text"
                          placeholder="Or type name…"
                          value={ns.owner_name}
                          onChange={e => updateStep(ns._key, { owner_name: e.target.value })}
                          className={`${inputCls} mt-1`}
                        />
                      )}
                    </td>
                    <td className="py-2 px-3 min-w-[140px]">
                      <input
                        type="date"
                        value={ns.due_date}
                        onChange={e => updateStep(ns._key, { due_date: e.target.value })}
                        className={inputCls}
                      />
                    </td>
                    <td className="py-2 pl-2">
                      <button
                        type="button"
                        onClick={() => removeStep(ns._key)}
                        className="rounded p-1 text-danger-400 hover:bg-danger-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {nextSteps.length === 0 && (
          <p className="text-sm text-neutral-400">No next steps added yet.</p>
        )}
      </section>

      {/* SECTION 6 — Linking */}
      <section className={sectionCls}>
        <h3 className="text-base font-semibold text-neutral-800">Linking (optional)</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {companies.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Company</label>
              <select
                value={companyId}
                onChange={e => setCompanyId(e.target.value)}
                className={selectCls}
              >
                <option value="">— None —</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                ))}
              </select>
            </div>
          )}

          {projects.length > 0 && (
            <div className="flex flex-col gap-1">
              <label className={labelCls}>Project</label>
              <select
                value={projectId}
                onChange={e => setProjectId(e.target.value)}
                className={selectCls}
              >
                <option value="">— None —</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-danger-500/30 bg-danger-50 px-4 py-3">
          <p className="text-sm text-danger-700">{error}</p>
        </div>
      )}

      {/* Submit buttons */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <Button
          variant="secondary"
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={() => handleSubmit(false)}
          loading={isPending}
        >
          Save as Draft
        </Button>
        <Button
          type="button"
          onClick={() => handleSubmit(true)}
          loading={isPending}
        >
          {isRevision ? 'Save & Re-submit' : 'Submit for Review'}
        </Button>
      </div>
    </div>
  )
}
