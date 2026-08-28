import { requireRole, getOrganization } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PLAN_LABELS, STATUS_LABELS, formatUsd, isStripeConfigured, orgNeedsPayment } from '@/lib/saas/plans'
import { Badge } from '@/components/ui/Badge'
import { BillingCheckout } from '@/components/billing/BillingCheckout'

export const metadata = { title: 'Billing — WSSO' }

interface Props {
  searchParams: { pay?: string; success?: string; canceled?: string }
}

export default async function BillingPage({ searchParams }: Props) {
  const profile = await requireRole(['admin'])
  const org = await getOrganization(profile.organization_id)

  if (!org) {
    return <p className="text-sm text-neutral-500">No workspace found.</p>
  }

  const { count: seatsUsed } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id)
    .eq('status', 'active')

  const { data: plans } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  const currentPlan = (plans ?? []).find((p) => p.id === org.plan_id)
  const used = seatsUsed ?? 0
  const due = orgNeedsPayment(org)
  const trialLeft = org.trial_ends_at
    ? Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Billing</h2>
        <p className="mt-1 text-sm text-neutral-500">
          You pay for the whole company (<span className="font-medium text-neutral-700">{org.name}</span>) through Stripe.
          Managers and employees do not see this page.
        </p>
      </div>

      {searchParams.success === '1' && (
        <div className="rounded-md border border-success-500/30 bg-success-50 px-4 py-3 text-sm text-success-700">
          Payment received. Your workspace is active.
        </div>
      )}
      {searchParams.canceled === '1' && (
        <div className="rounded-md border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Checkout canceled. You can try again when ready.
        </div>
      )}
      {(due || searchParams.pay === '1') && (
        <div className="rounded-md border border-warning-500/30 bg-warning-50 px-4 py-3 text-sm text-warning-700">
          Payment is required to keep using WSSO for this company.
        </div>
      )}

      <div className="card p-5">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Current plan</dt>
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
        </dl>
      </div>

      <div className="card p-5">
        <h3 className="text-sm font-semibold text-neutral-900">Subscribe or change plan</h3>
        <p className="mt-1 mb-4 text-sm text-neutral-500">
          This Stripe payment covers every user in your workspace.
        </p>
        <BillingCheckout
          plans={plans ?? []}
          currentPlanId={org.plan_id}
          stripeReady={isStripeConfigured()}
          hasStripeCustomer={Boolean(org.stripe_customer_id)}
        />
      </div>
    </div>
  )
}
