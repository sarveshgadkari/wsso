import { requireSuperAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PlatformOrgTable, type OrgListRow } from '@/components/platform/PlatformOrgTable'
import { Building2, Users, AlertTriangle, CreditCard } from 'lucide-react'
import { StatCard } from '@/components/dashboard/StatCard'
import { orgNeedsPayment } from '@/lib/saas/plans'

export const metadata = { title: 'Platform — WSSO' }

export default async function PlatformHomePage() {
  await requireSuperAdmin()

  const { data: orgs } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .order('created_at', { ascending: false })

  const list = orgs ?? []
  const orgIds = list.map((o) => o.id)

  const [{ data: profiles }, { data: tactics }] = await Promise.all([
    orgIds.length
      ? supabaseAdmin
          .from('profiles')
          .select('organization_id, status')
          .in('organization_id', orgIds)
          .eq('status', 'active')
      : Promise.resolve({ data: [] as { organization_id: string | null; status: string }[] }),
    orgIds.length
      ? supabaseAdmin
          .from('tactics')
          .select('organization_id')
          .in('organization_id', orgIds)
      : Promise.resolve({ data: [] as { organization_id: string }[] }),
  ])

  const seatMap: Record<string, number> = {}
  ;(profiles ?? []).forEach((p) => {
    if (!p.organization_id) return
    seatMap[p.organization_id] = (seatMap[p.organization_id] ?? 0) + 1
  })

  const woMap: Record<string, number> = {}
  ;(tactics ?? []).forEach((t) => {
    woMap[t.organization_id] = (woMap[t.organization_id] ?? 0) + 1
  })

  const { data: plans } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')

  const planName = Object.fromEntries((plans ?? []).map((p) => [p.id, p.name]))

  const rows: OrgListRow[] = list.map((org) => ({
    ...org,
    seat_count: seatMap[org.id] ?? 0,
    plan_name: org.plan_id ? planName[org.plan_id] : undefined,
    work_orders: woMap[org.id] ?? 0,
    payment_due: orgNeedsPayment(org),
  }))

  const active = list.filter((o) => o.status === 'active' || o.status === 'trial').length
  const blocked = list.filter((o) => o.status === 'suspended' || o.status === 'cancelled').length
  const unpaid = rows.filter((o) => o.payment_due).length
  const seatsUsed = Object.values(seatMap).reduce((a, b) => a + b, 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Platform</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Monitor every workspace: users, usage, and who still needs to subscribe.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Workspaces" value={list.length} icon={Building2} />
        <StatCard label="Active workspaces" value={active} variant="success" icon={Building2} />
        <StatCard
          label="Seats in use"
          value={seatsUsed}
          sub={blocked ? `${blocked} suspended` : undefined}
          icon={Users}
          variant={blocked ? 'warning' : 'default'}
        />
        <StatCard
          label="Need subscription"
          value={unpaid}
          variant={unpaid ? 'warning' : 'default'}
          icon={CreditCard}
        />
      </div>

      {blocked > 0 && (
        <p className="flex items-center gap-2 text-sm text-warning-700">
          <AlertTriangle className="h-4 w-4" />
          {blocked} workspace{blocked === 1 ? '' : 's'} suspended or cancelled.
        </p>
      )}

      <PlatformOrgTable orgs={rows} plans={plans ?? []} />
    </div>
  )
}
