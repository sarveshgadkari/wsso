'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, CheckCircle2, FileText, ExternalLink, ClipboardCheck, Link2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/lib/store/toast'
import {
  startTrainingModule,
  completeTrainingModule,
  submitTrainingTest,
  getTrainingFileUrl,
  type QuizOptionPublic,
} from '@/lib/actions/training'
import { normalizeTrainingLinks } from '@/lib/training/quiz'
import type { TrainingModule, TrainingProgress } from '@/lib/types'

interface Props {
  module: TrainingModule
  progress: TrainingProgress | null
  questions: {
    id: string
    question_text: string
    options: QuizOptionPublic[]
    order_no: number
  }[]
}

export function TrainingModuleDetail({ module, progress: initialProgress, questions }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [progress, setProgress] = useState(initialProgress)
  const [loading, setLoading] = useState(false)
  const [opening, setOpening] = useState(false)
  const [showTest, setShowTest] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [result, setResult] = useState<{
    passed: boolean
    score: number
    pass_percent: number
    correct_count: number
    total: number
  } | null>(null)

  const done = progress?.status === 'completed'
  const links = normalizeTrainingLinks(module.links)

  async function markStarted() {
    try {
      await startTrainingModule(module.id)
      setProgress(prev => prev ?? {
        id: '',
        module_id: module.id,
        employee_id: '',
        status: 'in_progress',
        test_score: null,
        test_passed: null,
        started_at: new Date().toISOString(),
        completed_at: null,
      })
      router.refresh()
    } catch {
      // non-blocking
    }
  }

  async function openFile() {
    setOpening(true)
    try {
      await startTrainingModule(module.id)
      const url = await getTrainingFileUrl(module.id)
      window.open(url, '_blank', 'noopener,noreferrer')
      setProgress(prev => prev ?? {
        id: '',
        module_id: module.id,
        employee_id: '',
        status: 'in_progress',
        test_score: null,
        test_passed: null,
        started_at: new Date().toISOString(),
        completed_at: null,
      })
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open file')
    } finally {
      setOpening(false)
    }
  }

  async function markComplete() {
    setLoading(true)
    try {
      await completeTrainingModule(module.id)
      setProgress(prev => ({
        ...(prev ?? {
          id: '',
          module_id: module.id,
          employee_id: '',
          test_score: null,
          test_passed: null,
          started_at: new Date().toISOString(),
        }),
        status: 'completed',
        completed_at: new Date().toISOString(),
      }))
      toast.success('Module completed')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not complete')
    } finally {
      setLoading(false)
    }
  }

  async function submitTest(e: React.FormEvent) {
    e.preventDefault()
    if (questions.some(q => !answers[q.id])) {
      toast.error('Answer every question')
      return
    }
    setLoading(true)
    try {
      const payload = questions.map(q => ({
        question_id: String(q.id),
        option_id: String(answers[q.id]),
      }))
      const res = await submitTrainingTest(module.id, payload)
      setResult(res)
      if (res.passed) {
        setProgress(prev => ({
          ...(prev ?? {
            id: '',
            module_id: module.id,
            employee_id: '',
            started_at: new Date().toISOString(),
          }),
          status: 'completed',
          test_score: res.score,
          test_passed: true,
          completed_at: new Date().toISOString(),
        }))
        toast.success(`Passed — ${res.correct_count}/${res.total} correct (${res.score}%)`)
      } else {
        toast.error(
          `Score ${res.score}% (${res.correct_count}/${res.total} correct). Need ${res.pass_percent}% to pass.`,
        )
      }
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submit failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <Link
          href="/training"
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-4 w-4" />
          All modules
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-neutral-900">{module.title}</h2>
              {done ? (
                <Badge variant="success">Completed</Badge>
              ) : progress ? (
                <Badge variant="warning">In progress</Badge>
              ) : (
                <Badge variant="default">Not started</Badge>
              )}
              {module.has_test && <Badge variant="info">Knowledge test</Badge>}
            </div>
            {module.description && (
              <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{module.description}</p>
            )}
          </div>
        </div>
      </div>

      {done && (
        <div className="flex items-start gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
          <div>
            <p className="text-sm font-semibold text-teal-900">Module completed</p>
            <p className="text-xs text-teal-800">
              You can reopen the material anytime for review.
              {progress?.test_score != null && ` Test score: ${progress.test_score}%.`}
            </p>
          </div>
        </div>
      )}

      <div className="card p-5">
        <h3 className="mb-3 text-sm font-semibold text-neutral-800">Training material</h3>

        {module.body_content && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Written content
            </p>
            <div
              className="whitespace-pre-wrap rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm leading-relaxed text-neutral-800"
              onFocus={markStarted}
              onMouseEnter={() => { if (!progress) void markStarted() }}
            >
              {module.body_content}
            </div>
          </div>
        )}

        {links.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Links
            </p>
            <ul className="flex flex-col gap-2">
              {links.map((link, i) => (
                <li key={`${link.url}-${i}`}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => { void markStarted() }}
                    className="flex items-center gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm text-primary-700 hover:bg-primary-50"
                  >
                    <Link2 className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate font-medium">{link.title || link.url}</span>
                    <ExternalLink className="ml-auto h-3.5 w-3.5 shrink-0 text-neutral-400" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {module.file_path ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              File
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-neutral-500" />
                <div>
                  <p className="text-sm font-medium text-neutral-800">{module.file_name}</p>
                  <p className="text-xs text-neutral-400">{module.file_type}</p>
                </div>
              </div>
              <Button size="sm" onClick={openFile} loading={opening}>
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </Button>
            </div>
          </div>
        ) : !module.body_content && !links.length ? (
          <p className="text-sm text-neutral-500">
            {module.description
              ? 'No extra material — follow the summary above.'
              : 'No material attached yet.'}
          </p>
        ) : null}
      </div>

      {!done && (
        <div className="card p-5">
          <h3 className="mb-2 text-sm font-semibold text-neutral-800">Complete this module</h3>
          {module.has_test && questions.length > 0 ? (
            <>
              <p className="mb-4 text-sm text-neutral-500">
                Review the material, then take the knowledge test. Pass score: {module.pass_percent}%.
              </p>
              {!showTest ? (
                <Button onClick={() => setShowTest(true)}>
                  <ClipboardCheck className="h-4 w-4" />
                  Take knowledge test
                </Button>
              ) : (
                <form onSubmit={submitTest} className="flex flex-col gap-5">
                  {questions.map((q, i) => (
                    <fieldset key={q.id} className="rounded-lg border border-neutral-200 p-4">
                      <legend className="px-1 text-sm font-medium text-neutral-800">
                        {i + 1}. {q.question_text}
                      </legend>
                      <div className="mt-2 flex flex-col gap-2">
                        {q.options.map((opt, oi) => {
                          const optId = opt.id || `opt-${oi}`
                          return (
                          <label
                            key={optId}
                            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                              answers[q.id] === optId
                                ? 'border-teal-400 bg-teal-50'
                                : 'border-neutral-200 hover:bg-neutral-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              value={optId}
                              checked={answers[q.id] === optId}
                              onChange={() => setAnswers(prev => ({ ...prev, [q.id]: optId }))}
                            />
                            {opt.text}
                          </label>
                          )
                        })}
                      </div>
                    </fieldset>
                  ))}
                  {result && (
                    <p className={`text-sm ${result.passed ? 'text-teal-700' : 'text-danger-600'}`}>
                      {result.passed ? 'Passed' : 'Not passed'} — {result.correct_count}/{result.total} correct
                      ({result.score}%). Pass mark: {result.pass_percent}%.
                      {!result.passed && ' You can change answers and try again.'}
                    </p>
                  )}
                  <Button type="submit" loading={loading}>Submit answers</Button>
                </form>
              )}
            </>
          ) : (
            <>
              <p className="mb-4 text-sm text-neutral-500">
                Open and review the material, then mark this module complete.
              </p>
              <Button onClick={markComplete} loading={loading}>
                <CheckCircle2 className="h-4 w-4" />
                Mark as complete
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
