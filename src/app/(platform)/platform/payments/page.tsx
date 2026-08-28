import { requireSuperAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { Badge } from '@/components/ui/Badge'
import { formatUsd } from '@/lib/saas/plans'

export const metadata = { title: 'Payments — Platform — WSSO' }

export default async function PlatformPaymentsPage() {
  await requireSuperAdmin()

  const { data: payments } = await supabaseAdmin
    .from('organization_payments')
    .select('id, amount_cents, currency, billing_interval, status, provider, paid_at, created_at, organization_id, plan_id')
    .order('created_at', { ascending: false })
    .limit(200)

  const orgIds = Array.from(new Set((payments ?? []).map((p) => p.organization_id)))
  const planIds = Array.from(new Set((payments ?? []).map((p) => p.plan_id).filter(Boolean) as string[]))

  const [{ data: orgs }, { data: plans }] = await Promise.all([
    orgIds.length
      ? supabaseAdmin.from('organizations').select('id, name, slug').in('id', orgIds)
      : Promise.resolve({ data: [] as { id: string; name: string; slug: string }[] }),
    planIds.length
      ? supabaseAdmin.from('subscription_plans').select('id, name').in('id', planIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ])

  const orgMap = Object.fromEntries((orgs ?? []).map((o) => [o.id, o]))
  const planMap = Object.fromEntries((plans ?? []).map((p) => [p.id, p]))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Payments</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Stripe Checkout, renewals, and any amounts marked paid offline.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-semibold">When</th>
              <th className="px-4 py-3 font-semibold">Workspace</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {(payments ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-neutral-400">No payments yet.</td>
              </tr>
            )}
            {(payments ?? []).map((p) => (
              <tr key={p.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3 text-neutral-500">
                  {new Date(p.paid_at ?? p.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <a className="text-primary-700 hover:underline" href={`/platform/organizations/${p.organization_id}`}>
                    {orgMap[p.organization_id]?.name ?? p.organization_id}
                  </a>
                </td>
                <td className="px-4 py-3">{(p.plan_id && planMap[p.plan_id]?.name) || '—'} · {p.billing_interval}</td>
                <td className="px-4 py-3 tabular-nums">{formatUsd(p.amount_cents)}</td>
                <td className="px-4 py-3">
                  <Badge variant={p.status === 'paid' ? 'success' : p.status === 'pending' ? 'warning' : 'danger'}>
                    {p.status} · {p.provider}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
