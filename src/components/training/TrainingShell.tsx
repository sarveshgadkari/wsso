'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  GraduationCap, CheckCircle2, Circle, Clock, FileText,
  Plus, Pencil, Trash2, ArrowUp, ArrowDown, Eye, EyeOff,
  Users, BookOpen, ClipboardList, ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/lib/store/toast'
import {
  createTrainingModule,
  deleteTrainingModule,
  reorderTrainingModules,
  updateTrainingModule,
  saveTrainingQuestions,
  getTrainingQuestionsAdmin,
  type ModuleWithProgress,
  type AdminProgressRow,
  type QuestionInput,
  type QuizOption,
} from '@/lib/actions/training'
import type { TrainingQuestion } from '@/lib/types'

type Tab = 'learn' | 'manage' | 'progress'

interface Props {
  modules: ModuleWithProgress[]
  isAdmin: boolean
  progressRows: AdminProgressRow[]
}

function formatBytes(n: number | null) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

function statusBadge(status: string | undefined) {
  if (status === 'completed') return <Badge variant="success">Completed</Badge>
  if (status === 'in_progress') return <Badge variant="warning">In progress</Badge>
  return <Badge variant="default">Not started</Badge>
}

export function TrainingShell({ modules: initial, isAdmin, progressRows }: Props) {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('learn')
  const [modules, setModules] = useState(initial)
  const [pending, startTransition] = useTransition()

  const published = useMemo(() => modules.filter(m => m.is_published), [modules])
  const completed = published.filter(m => m.progress?.status === 'completed').length
  const pct = published.length ? Math.round((completed / published.length) * 100) : 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Training</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Complete modules in order. Materials stay available anytime for review.
          </p>
        </div>
        {isAdmin && tab === 'manage' && (
          <CreateModuleButton
            onCreated={mod => {
              setModules(prev => [...prev, { ...mod, progress: null, question_count: 0 }])
              toast.success('Module created')
            }}
          />
        )}
      </div>

      {/* Progress summary */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50">
              <GraduationCap className="h-5 w-5 text-teal-700" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">Your progress</p>
              <p className="text-xs text-neutral-500">
                {completed} of {published.length} modules completed
              </p>
            </div>
          </div>
          <span className="text-2xl font-semibold tabular-nums text-teal-700">{pct}%</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full bg-teal-600 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {isAdmin && (
        <div className="flex gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
          {([
            { id: 'learn', label: 'My Learning', icon: BookOpen },
            { id: 'manage', label: 'Manage Modules', icon: ClipboardList },
            { id: 'progress', label: 'Team Progress', icon: Users },
          ] as const).map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'bg-white text-neutral-900 shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {(tab === 'learn' || !isAdmin) && (
        <LearnerList modules={isAdmin ? modules.filter(m => m.is_published) : modules} />
      )}

      {isAdmin && tab === 'manage' && (
        <AdminManageList
          modules={modules}
          pending={pending}
          onReorder={(ids) => {
            setModules(prev => {
              const map = new Map(prev.map(m => [m.id, m]))
              return ids.map((id, i) => {
                const m = map.get(id)!
                return { ...m, sequence_order: i + 1 }
              })
            })
            startTransition(async () => {
              try {
                await reorderTrainingModules(ids)
                toast.success('Sequence updated')
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Reorder failed')
              }
            })
          }}
          onUpdate={(id, patch) => {
            setModules(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)))
          }}
          onDelete={(id) => setModules(prev => prev.filter(m => m.id !== id))}
          onQuestionsSaved={(id, count) => {
            setModules(prev => prev.map(m =>
              m.id === id ? { ...m, question_count: count, has_test: count > 0 } : m,
            ))
          }}
        />
      )}

      {isAdmin && tab === 'progress' && (
        <AdminProgressTable rows={progressRows} />
      )}
    </div>
  )
}

function LearnerList({ modules }: { modules: ModuleWithProgress[] }) {
  if (!modules.length) {
    return (
      <div className="card px-5 py-12 text-center">
        <GraduationCap className="mx-auto h-10 w-10 text-neutral-300" />
        <p className="mt-3 text-sm text-neutral-500">No training modules yet.</p>
      </div>
    )
  }

  return (
    <ol className="flex flex-col gap-3">
      {modules.map((m, idx) => {
        const done = m.progress?.status === 'completed'
        const started = m.progress?.status === 'in_progress'
        return (
          <li key={m.id}>
            <Link
              href={`/training/${m.id}`}
              className="card flex items-start gap-4 p-4 transition-colors hover:border-teal-300 hover:bg-teal-50/40"
            >
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                done
                  ? 'bg-teal-600 text-white'
                  : started
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-neutral-100 text-neutral-600'
              }`}>
                {done ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-neutral-900">{m.title}</h3>
                  {statusBadge(m.progress?.status)}
                  {m.has_test && <Badge variant="info">Knowledge test</Badge>}
                </div>
                {m.description && (
                  <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{m.description}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-neutral-400">
                  {m.file_name && (
                    <span className="inline-flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" />
                      {m.file_name}
                      {m.file_size ? ` · ${formatBytes(m.file_size)}` : ''}
                    </span>
                  )}
                  {started && !done && (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <Clock className="h-3.5 w-3.5" /> Continue
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        )
      })}
    </ol>
  )
}

function CreateModuleButton({
  onCreated,
}: {
  onCreated: (m: import('@/lib/types').TrainingModule) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [hasTest, setHasTest] = useState(false)
  const [passPercent, setPassPercent] = useState(80)
  const [file, setFile] = useState<File | null>(null)
  const toast = useToast()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const fd = new FormData()
      fd.set('title', title)
      fd.set('description', description)
      fd.set('has_test', hasTest ? 'true' : 'false')
      fd.set('pass_percent', String(passPercent))
      fd.set('is_published', 'true')
      if (file) fd.set('file', file)
      const mod = await createTrainingModule(fd)
      onCreated(mod)
      setOpen(false)
      setTitle('')
      setDescription('')
      setHasTest(false)
      setFile(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Add module
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="New training module" size="lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input
            label="Title *"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Company onboarding — Module 1"
            required
          />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700">Description</label>
            <textarea
              rows={3}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What learners should know after this module…"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700">Material (PDF, PPT, DOC…)</label>
            <input
              type="file"
              accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={hasTest}
              onChange={e => setHasTest(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Require knowledge test to complete
          </label>
          {hasTest && (
            <Input
              label="Pass score (%)"
              type="number"
              min={1}
              max={100}
              value={passPercent}
              onChange={e => setPassPercent(Number(e.target.value) || 80)}
            />
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>Create module</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  )
}

function AdminManageList({
  modules,
  pending,
  onReorder,
  onUpdate,
  onDelete,
  onQuestionsSaved,
}: {
  modules: ModuleWithProgress[]
  pending: boolean
  onReorder: (ids: string[]) => void
  onUpdate: (id: string, patch: Partial<ModuleWithProgress>) => void
  onDelete: (id: string) => void
  onQuestionsSaved: (id: string, count: number) => void
}) {
  const toast = useToast()
  const ordered = [...modules].sort((a, b) => a.sequence_order - b.sequence_order)

  function move(index: number, dir: -1 | 1) {
    const next = index + dir
    if (next < 0 || next >= ordered.length) return
    const ids = ordered.map(m => m.id)
    ;[ids[index], ids[next]] = [ids[next], ids[index]]
    onReorder(ids)
  }

  if (!ordered.length) {
    return (
      <div className="card px-5 py-10 text-center text-sm text-neutral-500">
        No modules yet. Click <strong>Add module</strong> to upload the first one.
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {ordered.map((m, i) => (
        <li key={m.id} className="card flex flex-wrap items-center gap-3 p-4">
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              disabled={pending || i === 0}
              onClick={() => move(i, -1)}
              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
              aria-label="Move up"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={pending || i === ordered.length - 1}
              onClick={() => move(i, 1)}
              className="rounded p-0.5 text-neutral-400 hover:bg-neutral-100 disabled:opacity-30"
              aria-label="Move down"
            >
              <ArrowDown className="h-4 w-4" />
            </button>
          </div>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-600">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-neutral-900">{m.title}</p>
              {!m.is_published && <Badge variant="default">Draft</Badge>}
              {m.has_test && <Badge variant="info">{m.question_count} Qs</Badge>}
            </div>
            <p className="truncate text-xs text-neutral-400">
              {m.file_name ?? 'No file'} {m.description ? `· ${m.description.slice(0, 60)}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <Link href={`/training/${m.id}`}>
              <Button size="sm" variant="ghost" type="button">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
            <EditModuleButton
              module={m}
              onSaved={patch => onUpdate(m.id, patch)}
            />
            <QuestionsEditorButton
              moduleId={m.id}
              passPercent={m.pass_percent}
              onSaved={count => onQuestionsSaved(m.id, count)}
            />
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={async () => {
                try {
                  await updateTrainingModule(m.id, { is_published: !m.is_published })
                  onUpdate(m.id, { is_published: !m.is_published })
                  toast.success(m.is_published ? 'Hidden from learners' : 'Published')
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Update failed')
                }
              }}
            >
              {m.is_published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              type="button"
              onClick={async () => {
                if (!confirm(`Delete “${m.title}”? This cannot be undone.`)) return
                try {
                  await deleteTrainingModule(m.id)
                  onDelete(m.id)
                  toast.success('Module deleted')
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Delete failed')
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5 text-danger-500" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function EditModuleButton({
  module: m,
  onSaved,
}: {
  module: ModuleWithProgress
  onSaved: (patch: Partial<ModuleWithProgress>) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState(m.title)
  const [description, setDescription] = useState(m.description ?? '')
  const [passPercent, setPassPercent] = useState(m.pass_percent)
  const toast = useToast()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await updateTrainingModule(m.id, {
        title,
        description,
        pass_percent: passPercent,
      })
      onSaved({ title, description, pass_percent: passPercent })
      setOpen(false)
      toast.success('Saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" type="button" onClick={() => {
        setTitle(m.title)
        setDescription(m.description ?? '')
        setPassPercent(m.pass_percent)
        setOpen(true)
      }}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Edit module" size="lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input label="Title *" value={title} onChange={e => setTitle(e.target.value)} required />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700">Description</label>
            <textarea
              rows={3}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <Input
            label="Pass score (%)"
            type="number"
            min={1}
            max={100}
            value={passPercent}
            onChange={e => setPassPercent(Number(e.target.value) || 80)}
          />
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>Save</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  )
}

function emptyQuestion(): QuestionInput {
  return {
    question_text: '',
    options: [
      { id: 'a', text: '', is_correct: true },
      { id: 'b', text: '', is_correct: false },
    ],
  }
}

function QuestionsEditorButton({
  moduleId,
  onSaved,
}: {
  moduleId: string
  passPercent: number
  onSaved: (count: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState<QuestionInput[]>([emptyQuestion()])
  const toast = useToast()

  async function openEditor() {
    setOpen(true)
    try {
      const existing = await getTrainingQuestionsAdmin(moduleId)
      if (existing.length) {
        setQuestions(existing.map((q: TrainingQuestion) => ({
          question_text: q.question_text,
          options: (q.options as QuizOption[]).map(o => ({ ...o })),
        })))
      } else {
        setQuestions([emptyQuestion()])
      }
    } catch {
      setQuestions([emptyQuestion()])
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const cleaned = questions.filter(q => q.question_text.trim())
      await saveTrainingQuestions(moduleId, cleaned)
      onSaved(cleaned.length)
      setOpen(false)
      toast.success(cleaned.length ? 'Knowledge test saved' : 'Knowledge test cleared')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button size="sm" variant="ghost" type="button" onClick={openEditor}>
        <ClipboardList className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Knowledge test" size="xl" description="Add multiple-choice questions. Learners must pass to complete the module.">
        <form onSubmit={submit} className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1">
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-lg border border-neutral-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Question {qi + 1}
                </span>
                {questions.length > 1 && (
                  <button
                    type="button"
                    className="text-xs text-danger-600 hover:underline"
                    onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qi))}
                  >
                    Remove
                  </button>
                )}
              </div>
              <textarea
                rows={2}
                required
                placeholder="Question text"
                className="mb-2 w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
                value={q.question_text}
                onChange={e => {
                  const v = e.target.value
                  setQuestions(prev => prev.map((x, i) => i === qi ? { ...x, question_text: v } : x))
                }}
              />
              <div className="flex flex-col gap-2">
                {q.options.map((opt, oi) => (
                  <div key={opt.id} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${qi}`}
                      checked={opt.is_correct}
                      onChange={() => {
                        setQuestions(prev => prev.map((x, i) => {
                          if (i !== qi) return x
                          return {
                            ...x,
                            options: x.options.map((o, j) => ({ ...o, is_correct: j === oi })),
                          }
                        }))
                      }}
                      title="Correct answer"
                    />
                    <input
                      type="text"
                      required
                      placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                      className="flex-1 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                      value={opt.text}
                      onChange={e => {
                        const v = e.target.value
                        setQuestions(prev => prev.map((x, i) => {
                          if (i !== qi) return x
                          return {
                            ...x,
                            options: x.options.map((o, j) => j === oi ? { ...o, text: v } : o),
                          }
                        }))
                      }}
                    />
                    {q.options.length > 2 && (
                      <button
                        type="button"
                        className="text-xs text-neutral-400 hover:text-danger-600"
                        onClick={() => {
                          setQuestions(prev => prev.map((x, i) => {
                            if (i !== qi) return x
                            const options = x.options.filter((_, j) => j !== oi)
                            if (!options.some(o => o.is_correct) && options[0]) {
                              options[0] = { ...options[0], is_correct: true }
                            }
                            return { ...x, options }
                          }))
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {q.options.length < 6 && (
                  <button
                    type="button"
                    className="self-start text-xs font-medium text-primary-600 hover:underline"
                    onClick={() => {
                      setQuestions(prev => prev.map((x, i) => {
                        if (i !== qi) return x
                        const id = String.fromCharCode(97 + x.options.length)
                        return {
                          ...x,
                          options: [...x.options, { id, text: '', is_correct: false }],
                        }
                      }))
                    }}
                  >
                    + Add option
                  </button>
                )}
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setQuestions(prev => [...prev, emptyQuestion()])}
          >
            <Plus className="h-3.5 w-3.5" />
            Add question
          </Button>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" loading={loading}>Save test</Button>
          </DialogFooter>
        </form>
      </Dialog>
    </>
  )
}

function AdminProgressTable({ rows }: { rows: AdminProgressRow[] }) {
  if (!rows.length) {
    return (
      <div className="card px-5 py-10 text-center text-sm text-neutral-500">
        No active employees to track yet.
      </div>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Employee</th>
              <th className="px-4 py-3 font-semibold">Progress</th>
              <th className="px-4 py-3 font-semibold">Modules</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map(row => {
              const pct = row.total_modules
                ? Math.round((row.completed_count / row.total_modules) * 100)
                : 0
              return (
                <tr key={row.employee_id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-neutral-900">{row.full_name}</p>
                    <p className="text-xs text-neutral-400">
                      {row.employee_code} · {row.role}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium tabular-nums text-neutral-800">
                      {row.completed_count}/{row.total_modules} ({pct}%)
                    </p>
                    <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-neutral-100">
                      <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ul className="flex flex-col gap-1">
                      {row.modules.map(m => (
                        <li key={m.module_id} className="flex items-center gap-2 text-xs">
                          {m.status === 'completed' ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                          ) : m.status === 'in_progress' ? (
                            <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
                          )}
                          <span className="text-neutral-700">{m.title}</span>
                          {m.test_score != null && (
                            <span className="text-neutral-400">({m.test_score}%)</span>
                          )}
                        </li>
                      ))}
                      {!row.modules.length && (
                        <li className="text-xs text-neutral-400">No published modules</li>
                      )}
                    </ul>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
