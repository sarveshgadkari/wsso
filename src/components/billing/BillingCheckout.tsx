'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { formatUsd } from '@/lib/saas/plans'
import type { SubscriptionPlan } from '@/lib/types'

function publicPlans(plans: SubscriptionPlan[]) {
  const visible = plans.filter(
    (p) => !(p.slug === 'trial' && p.monthly_price_cents === 0 && p.yearly_price_cents === 0),
  )
  return visible.length > 0 ? visible : plans
}

export function BillingCheckout({
  plans,
  currentPlanId,
  stripeReady,
  hasStripeCustomer,
  initialPlanId,
  initialInterval,
}: {
  plans: SubscriptionPlan[]
  currentPlanId: string | null
  stripeReady: boolean
  hasStripeCustomer: boolean
  initialPlanId?: string | null
  initialInterval?: 'month' | 'year'
}) {
  const list = publicPlans(plans)
  const [planId, setPlanId] = useState(initialPlanId || currentPlanId || list[0]?.id || '')
  const [interval, setInterval] = useState<'month' | 'year'>(initialInterval ?? 'month')
  const [busy, setBusy] = useState(false)
  const [portalBusy, setPortalBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const plan = list.find((p) => p.id === planId) ?? plans.find((p) => p.id === planId)
  const amount = plan ? (interval === 'year' ? plan.yearly_price_cents : plan.monthly_price_cents) : 0
  const isCurrent = Boolean(planId && planId === currentPlanId)

  const pay = async () => {
    setError(null)
    if (!stripeReady && amount > 0) {
      setError('Stripe is not configured. Add STRIPE_SECRET_KEY on the server.')
      return
    }
    setBusy(true)
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId, interval }),
    })
    const json = await res.json().catch(() => ({})) as { url?: string; error?: string }
    setBusy(false)
    if (!res.ok || !json.url) {
      setError(json.error ?? 'Could not start Stripe Checkout')
      return
    }
    window.location.href = json.url
  }

  const openPortal = async () => {
    setError(null)
    setPortalBusy(true)
    const res = await fetch('/api/billing/portal', { method: 'POST' })
    const json = await res.json().catch(() => ({})) as { url?: string; error?: string }
    setPortalBusy(false)
    if (!res.ok || !json.url) {
      setError(json.error ?? 'Could not open Stripe Customer Portal')
      return
    }
    window.location.href = json.url
  }

  if (list.length === 0) {
    return <p className="text-sm text-neutral-500">No plans are available yet. Contact the platform owner.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-neutral-500">
        Choose a plan, then subscribe. Amounts are in United States dollars (USD). Card payments are
        processed by Stripe. After the first payment you can update the card, download invoices, or
        cancel from the Stripe portal.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPlanId(p.id)}
            className={`rounded-lg border p-4 text-left transition-colors ${
              planId === p.id ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 bg-white hover:border-neutral-300'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-neutral-900">{p.name}</p>
              {p.id === currentPlanId && (
                <span className="text-[10px] font-semibold uppercase tracking-wide text-primary-700">Current</span>
              )}
            </div>
            <p className="mt-1 text-sm text-neutral-500">{p.description}</p>
            <p className="mt-2 text-sm font-medium tabular-nums">
              {formatUsd(p.monthly_price_cents)}/mo · {formatUsd(p.yearly_price_cents)}/yr · {p.seat_limit} seats
            </p>
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <Button type="button" variant={interval === 'month' ? 'primary' : 'secondary'} size="sm" onClick={() => setInterval('month')}>
          Monthly
        </Button>
        <Button type="button" variant={interval === 'year' ? 'primary' : 'secondary'} size="sm" onClick={() => setInterval('year')}>
          Yearly
        </Button>
      </div>

      {error && <p className="text-sm text-danger-700">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <Button onClick={pay} loading={busy} disabled={!planId || (!stripeReady && amount > 0)}>
          {amount === 0
            ? 'Activate free plan'
            : isCurrent
              ? `Renew ${formatUsd(amount)} ${interval === 'year' ? 'per year' : 'per month'}`
              : `Subscribe ${formatUsd(amount)} ${interval === 'year' ? 'per year' : 'per month'}`}
        </Button>
        {hasStripeCustomer && stripeReady && (
          <Button type="button" variant="secondary" onClick={openPortal} loading={portalBusy}>
            Manage card, invoices & cancel
          </Button>
        )}
      </div>

      <p className="text-xs leading-relaxed text-neutral-500">
        By continuing, you authorize TLBISBIG Consulting Group, LLC to charge{' '}
        {amount === 0 ? 'USD $0' : `${formatUsd(amount)} USD`}{' '}
        {interval === 'year' ? 'each year' : 'each month'} until you cancel. Recurring charges auto-renew.
        Cancel anytime from this page or the Stripe portal. See{' '}
        <Link href="/terms" className="text-primary-600 hover:underline">Terms</Link>,{' '}
        <Link href="/privacy" className="text-primary-600 hover:underline">Privacy</Link>, and{' '}
        <Link href="/refunds" className="text-primary-600 hover:underline">Refunds &amp; cancellation</Link>.
      </p>

      {!stripeReady && amount > 0 && (
        <p className="text-xs text-warning-700">
          Stripe keys are missing. Add <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code> to the server env, then reload.
        </p>
      )}
    </div>
  )
}
