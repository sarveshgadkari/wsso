import { requireSuperAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { PlansManager } from '@/components/platform/PlansManager'

export const metadata = { title: 'Plans — Platform — WSSO' }

export default async function PlatformPlansPage() {
  await requireSuperAdmin()
  const { data: plans } = await supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .order('sort_order')

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Subscription plans</h2>
        <p className="mt-1 text-sm text-neutral-500">
          You set the prices. Workspace admins subscribe the whole company — employees do not pay.
        </p>
      </div>
      <PlansManager plans={plans ?? []} />
    </div>
  )
}
