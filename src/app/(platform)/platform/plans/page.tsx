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
          These are fully dynamic. Edit, hide, or delete any plan — including the starter Trial / Starter / Growth
          / Business / Enterprise rows. What you save here is what customers see on the landing page and at checkout.
        </p>
      </div>
      <PlansManager plans={plans ?? []} />
    </div>
  )
}
