import { requireRole, getOrganization } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PLAN_LABELS, STATUS_LABELS, formatUsd, isStripeConfigured, orgNeedsPayment } from '@/lib/saas/plans'
import { recoverPaidCheckout } from '@/lib/saas/stripe-sync'
import { Badge } from '@/components/ui/Badge'
import { BillingCheckout } from '@/components/billing/BillingCheckout'

export const metadata = { title: 'Subscription — WSSO' }

interface Props {
  searchParams: {
    pay?: string
    success?: string
    canceled?: string
    choose?: string
    plan?: string
    interval?: string
  }
}

export default async function BillingPage({ searchParams }: Props) {
  const profile = await requireRole(['admin'])
  let org = await getOrganization(profile.organization_id)

  if (!org) {
    return <p className="text-sm text-neutral-500">No workspace found.</p>
  }

  if (searchParams.success === '1' && orgNeedsPayment(org)) {
    await recoverPaidCheckout(org.id)
    org = (await getOrganization(profile.organization_id)) ?? org
  }

  const [{ count: seatsUsed }, { data: plans }, { data: payments }] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', org.id)
      .eq('status', 'active'),
    supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order'),
    supabaseAdmin
      .from('organization_payments')
      .select('id, amount_cents, billing_interval, status, provider, paid_at, created_at, plan_id')
      .eq('organization_id', org.id)
      .order('created_at', { ascending: false })
      .limit(8),
  ])

  const currentPlan = (plans ?? []).find((p) => p.id === org.plan_id)
  const used = seatsUsed ?? 0
  const due = orgNeedsPayment(org)
  const trialLeft = org.trial_ends_at
    ? Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const choosing = searchParams.choose === '1' || due || searchParams.pay === '1'
  const initialInterval = searchParams.interval === 'year' ? 'year' : 'month'
  const planIds = new Set((plans ?? []).map((p) => p.id))
  const initialPlanId = searchParams.plan && planIds.has(searchParams.plan) ? searchParams.plan : null

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Subscription</h2>
        <p className="mt-1 text-sm text-neutral-500">
          You pay for the whole company (<span className="font-medium text-neutral-700">{org.name}</span>).
          Change plan, renew, or manage the card here.
        </p>
      </div>

      {searchParams.success === '1' && !due && (
        <div className="rounded-md border border-success-500/30 bg-success-50 px-4 py-3 text-sm text-success-700">
          Payment received. Your workspace is active.
        </div>
      )}
      {searchParams.success === '1' && due && (
        <div className="rounded-md border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Stripe Checkout finished, but this workspace is still marked unpaid.
          Refresh this page in a few seconds. If it stays on Payment due, the Stripe webhook is not reaching WSSO
          (URL <span className="font-mono text-xs">/api/billing/webhook</span> and signing secret on Vercel).
        </div>
      )}
      {searchParams.canceled === '1' && (
        <div className="rounded-md border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Checkout canceled. Choose a plan below when you are ready.
        </div>
      )}
      {searchParams.choose === '1' && !searchParams.success && (
        <div className="rounded-md border border-primary-200 bg-primary-50 px-4 py-3 text-sm text-primary-800">
          Workspace created. Choose a plan below and subscribe for the company.
        </div>
      )}
      {due && searchParams.choose !== '1' && (
        <div className="rounded-md border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Payment is required to keep using WSSO for this company.
        </div>
      )}

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900">Current subscription</h3>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Plan</dt>
            <dd className="mt-1 text-lg font-semibold">{currentPlan?.name ?? PLAN_LABELS[org.plan]}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Status</dt>
            <dd className="mt-1">
              <Badge variant={org.status === 'active' ? 'success' : org.status === 'trial' ? 'info' : 'warning'}>
                {STATUS_LABELS[org.status]}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Seats</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{used} / {org.seat_limit}</dd>
          </div>
          {org.current_period_end && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Current period ends</dt>
              <dd className="mt-1 text-sm">{new Date(org.current_period_end).toLocaleDateString()}</dd>
            </div>
          )}
          {org.status === 'trial' && trialLeft !== null && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Trial</dt>
              <dd className="mt-1 text-lg font-semibold">
                {trialLeft > 0 ? `${trialLeft} days left` : 'Ended'}
              </dd>
            </div>
          )}
          {currentPlan && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-400">List price</dt>
              <dd className="mt-1 text-sm">
                {formatUsd(currentPlan.monthly_price_cents)}/mo or {formatUsd(currentPlan.yearly_price_cents)}/yr
              </dd>
            </div>
          )}
          {org.billing_interval && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Billing interval</dt>
              <dd className="mt-1 text-sm capitalize">{org.billing_interval === 'year' ? 'Yearly' : 'Monthly'}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900">
          {choosing ? 'Choose a plan and subscribe' : 'Change plan or renew'}
        </h3>
        <p className="mt-1 mb-4 text-sm text-neutral-500">
          This Stripe payment covers every user in your workspace.
        </p>
        <BillingCheckout
          plans={plans ?? []}
          currentPlanId={org.plan_id}
          stripeReady={isStripeConfigured()}
          hasStripeCustomer={Boolean(org.stripe_customer_id)}
          initialPlanId={initialPlanId}
          initialInterval={initialInterval}
        />
      </div>

      {(payments ?? []).length > 0 && (
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900">Payment history</h3>
          <ul className="mt-3 divide-y divide-neutral-100">
            {(payments ?? []).map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div>
                  <p className="font-medium text-neutral-800">{formatUsd(p.amount_cents)}</p>
                  <p className="text-xs text-neutral-400">
                    {p.provider} · {p.billing_interval === 'year' ? 'yearly' : 'monthly'} ·{' '}
                    {new Date(p.paid_at ?? p.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'}>
                  {p.status}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
