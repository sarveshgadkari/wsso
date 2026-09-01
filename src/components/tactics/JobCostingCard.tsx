import { DollarSign } from 'lucide-react'
import type { JobCostSummary } from '@/lib/actions/ops'

export function JobCostingCard({ cost }: { cost: JobCostSummary }) {
  const est = cost.estimatedHours
  const over = est != null && cost.hours > est
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-neutral-400" />
        <h3 className="text-sm font-semibold text-neutral-700">Job costing</h3>
        {!cost.billable && <span className="text-xs text-neutral-400">non-billable</span>}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-neutral-400">Hours logged</dt>
          <dd className={`font-semibold ${over ? 'text-danger-600' : 'text-neutral-800'}`}>{cost.hours.toFixed(1)}h</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-400">Estimated</dt>
          <dd className="font-semibold text-neutral-800">{est != null ? `${est}h` : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-400">Rate</dt>
          <dd className="font-semibold text-neutral-800">${(cost.rateCents / 100).toFixed(2)}/hr</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-400">Labor cost</dt>
          <dd className="font-semibold text-neutral-800">${(cost.costCents / 100).toFixed(2)}</dd>
        </div>
      </dl>
      {cost.rateCents === 0 && (
        <p className="mt-3 text-xs text-neutral-400">Set an hourly rate in Workspace settings → Pay & skills.</p>
      )}
    </div>
  )
}
