import type { Metadata } from 'next'
import { SignupForm } from '@/components/auth/SignupForm'
import { isSignupEnabled } from '@/lib/saas/plans'
import { supabaseAdmin } from '@/lib/supabase/admin'
import type { SubscriptionPlan } from '@/lib/types'

export const metadata: Metadata = { title: 'Create workspace — WSSO' }

interface Props {
  searchParams: { plan?: string; interval?: string }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function SignupPage({ searchParams }: Props) {
  if (!isSignupEnabled()) {
    return (
      <div className="text-center">
        <h1 className="text-xl font-semibold text-neutral-900">Signup is closed</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Contact us to get a workspace. If you already have one,{' '}
          <a href="/login" className="text-primary-600 hover:underline">sign in</a>.
        </p>
      </div>
    )
  }

  const interval = searchParams.interval === 'year' ? 'year' : 'month'
  let plan: SubscriptionPlan | null = null
  if (searchParams.plan && UUID.test(searchParams.plan)) {
    const { data } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .eq('id', searchParams.plan)
      .eq('is_active', true)
      .maybeSingle()
    plan = data
  }

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-xl font-semibold text-neutral-900">Start your workspace</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Create your admin account first. Next you will choose a plan and subscribe for the company.
        </p>
      </div>
      <SignupForm plan={plan} interval={interval} />
    </>
  )
}
