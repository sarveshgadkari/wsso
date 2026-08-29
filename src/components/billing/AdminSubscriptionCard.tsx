import Link from 'next/link'
import { CreditCard } from 'lucide-react'
import { getOrganization, requireProfile } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PLAN_LABELS, STATUS_LABELS, orgNeedsPayment } from '@/lib/saas/plans'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

export async function AdminSubscriptionCard() {
  const profile = await requireProfile()
  if (profile.role !== 'admin') return null

  const org = await getOrganization(profile.organization_id)
  if (!org) return null

  const { data: plan } = org.plan_id
    ? await supabaseAdmin.from('subscription_plans').select('name').eq('id', org.plan_id).maybeSingle()
    : { data: null }

  const due = orgNeedsPayment(org)
  const name = plan?.name ?? PLAN_LABELS[org.plan]

  return (
    <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Company subscription</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-base font-semibold text-neutral-900">{name}</p>
          <Badge variant={org.status === 'active' ? 'success' : org.status === 'trial' ? 'info' : 'warning'}>
            {STATUS_LABELS[org.status]}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-neutral-500">
          {due
            ? 'Choose a plan and subscribe to unlock the workspace for your team.'
            : 'Change plan, renew, or manage the card from Subscription.'}
        </p>
      </div>
      <Link href={due ? '/settings/billing?choose=1' : '/settings/billing'}>
        <Button variant={due ? 'gold' : 'secondary'} size="sm">
          <CreditCard className="h-4 w-4" />
          {due ? 'Choose a plan' : 'Manage subscription'}
        </Button>
      </Link>
    </div>
  )
}
