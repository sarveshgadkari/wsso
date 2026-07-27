import Link from 'next/link'
import { GraduationCap, ArrowRight } from 'lucide-react'
import { getMyTrainingSummary } from '@/lib/actions/training'

export async function TrainingDashboardCard() {
  let total = 0
  let completed = 0
  try {
    const s = await getMyTrainingSummary()
    total = s.total
    completed = s.completed
  } catch {
    total = 0
    completed = 0
  }

  const pct = total ? Math.round((completed / total) * 100) : 0

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50">
            <GraduationCap className="h-5 w-5 text-teal-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">Training</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              Modules, materials, and knowledge checks
            </p>
          </div>
        </div>
        <Link
          href="/training"
          className="flex shrink-0 items-center gap-1 text-sm font-medium text-primary-600 hover:underline"
        >
          Open
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-neutral-500">
          <span>
            {total === 0
              ? 'No modules published yet'
              : `${completed} of ${total} completed`}
          </span>
          {total > 0 && <span className="font-medium tabular-nums text-teal-700">{pct}%</span>}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}
