'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createSubscriptionPlan, updateSubscriptionPlan } from '@/lib/actions/billing'
import { useToast } from '@/lib/store/toast'
import { formatUsd } from '@/lib/saas/plans'
import type { SubscriptionPlan } from '@/lib/types'

function dollarsToCents(v: string): number {
  const n = Number(v)
  if (Number.isNaN(n) || n < 0) return 0
  return Math.round(n * 100)
}

function centsToDollars(cents: number): string {
  return (cents / 100).toFixed(2)
}

export function PlansManager({ plans }: { plans: SubscriptionPlan[] }) {
  const router = useRouter()
  const toast = useToast()
  const [editing, setEditing] = useState<string | 'new' | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditing('new')}>New plan</Button>
      </div>

      {editing === 'new' && (
        <PlanEditor
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); router.refresh() }}
        />
      )}

      {plans.map((plan) => (
        <div key={plan.id} className="card p-5">
          {editing === plan.id ? (
            <PlanEditor
              plan={plan}
              onCancel={() => setEditing(null)}
              onSaved={() => { setEditing(null); router.refresh() }}
            />
          ) : (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-neutral-900">
                  {plan.name}
                  {!plan.is_active && <span className="ml-2 text-xs font-normal text-neutral-400">hidden</span>}
                </p>
                <p className="text-sm text-neutral-500">{plan.description || 'No description'}</p>
                <p className="mt-2 text-sm tabular-nums text-neutral-700">
                  {formatUsd(plan.monthly_price_cents)}/mo · {formatUsd(plan.yearly_price_cents)}/yr · {plan.seat_limit} seats
                  {plan.trial_days > 0 ? ` · ${plan.trial_days}-day trial` : ''}
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={() => setEditing(plan.id)}>Edit</Button>
            </div>
          )}
        </div>
      ))}

      {plans.length === 0 && editing !== 'new' && (
        <p className="text-sm text-neutral-500">No plans yet. Create Starter / Growth prices you want to sell.</p>
      )}
    </div>
  )
}

function PlanEditor({
  plan,
  onCancel,
  onSaved,
}: {
  plan?: SubscriptionPlan
  onCancel: () => void
  onSaved: () => void
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState(plan?.name ?? '')
  const [description, setDescription] = useState(plan?.description ?? '')
  const [monthly, setMonthly] = useState(centsToDollars(plan?.monthly_price_cents ?? 0))
  const [yearly, setYearly] = useState(centsToDollars(plan?.yearly_price_cents ?? 0))
  const [seats, setSeats] = useState(String(plan?.seat_limit ?? 10))
  const [trial, setTrial] = useState(String(plan?.trial_days ?? 14))
  const [active, setActive] = useState(plan?.is_active ?? true)

  const save = async () => {
    setBusy(true)
    const payload = {
      name,
      description,
      monthly_price_cents: dollarsToCents(monthly),
      yearly_price_cents: dollarsToCents(yearly),
      seat_limit: Number(seats) || 10,
      trial_days: Number(trial) || 0,
      is_active: active,
    }
    const result = plan
      ? await updateSubscriptionPlan(plan.id, payload)
      : await createSubscriptionPlan(payload)
    setBusy(false)
    if (result.error) toast.error(result.error)
    else {
      toast.success(plan ? 'Plan updated' : 'Plan created')
      onSaved()
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Input label="Plan name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Monthly price (USD)" type="number" min={0} step="0.01" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        <Input label="Yearly price (USD)" type="number" min={0} step="0.01" value={yearly} onChange={(e) => setYearly(e.target.value)} />
        <Input label="Seats included" type="number" min={1} value={seats} onChange={(e) => setSeats(e.target.value)} />
        <Input label="Trial days" type="number" min={0} value={trial} onChange={(e) => setTrial(e.target.value)} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Visible to customers (admin billing page)
      </label>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} loading={busy}>Save plan</Button>
        <Button size="sm" variant="secondary" type="button" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}
