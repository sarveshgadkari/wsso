'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { formatUsd } from '@/lib/saas/plans'
import type { SubscriptionPlan } from '@/lib/types'

const schema = z.object({
  workspace_name: z.string().min(2, 'Workspace name is required'),
  full_name:      z.string().min(1, 'Your name is required'),
  email:          z.string().email('Enter a valid email'),
  password:       z.string().min(8, 'At least 8 characters'),
  agree:          z.literal(true, { errorMap: () => ({ message: 'You must agree to the Terms and Privacy Policy' }) }),
})

type FormValues = z.infer<typeof schema>

export function SignupForm({
  plan,
  interval,
}: {
  plan: SubscriptionPlan | null
  interval: 'month' | 'year'
}) {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const amount = plan
    ? (interval === 'year' ? plan.yearly_price_cents : plan.monthly_price_cents)
    : 0

  const onSubmit = async (values: FormValues) => {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspace_name: values.workspace_name,
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        plan_id: plan?.id,
        interval,
      }),
    })
    const json = await res.json().catch(() => ({})) as { error?: string }

    if (!res.ok) {
      setError('root', { message: json.error ?? 'Could not create workspace' })
      return
    }

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    })
    if (signInError) {
      router.push('/login?signup=1')
      return
    }

    const params = new URLSearchParams({ choose: '1' })
    if (plan?.id) params.set('plan', plan.id)
    params.set('interval', interval)
    router.push(`/settings/billing?${params.toString()}`)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {errors.root && (
        <div className="rounded-md border border-danger-500/30 bg-danger-50 px-4 py-3">
          <p className="text-sm text-danger-700">{errors.root.message}</p>
        </div>
      )}

      {plan && (
        <div className="rounded-md border border-primary-100 bg-primary-50 px-3 py-2 text-sm text-primary-800">
          <p className="font-medium">Next: choose {plan.name}</p>
          <p className="text-xs text-primary-700">
            {amount === 0 ? 'Free' : `${formatUsd(amount)} / ${interval === 'year' ? 'year' : 'month'}`}
            {' · '}{plan.seat_limit} seats
            {plan.trial_days > 0 && amount > 0 ? ` · ${plan.trial_days}-day trial` : ''}
            . You will subscribe after this account is created.
          </p>
        </div>
      )}

      <Input
        label="Company / workspace name"
        placeholder="Acme Inc"
        error={errors.workspace_name?.message}
        {...register('workspace_name')}
      />
      <Input
        label="Your name"
        placeholder="Jane Doe"
        error={errors.full_name?.message}
        {...register('full_name')}
      />
      <Input
        label="Work email"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <Input
        label="Password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 8 characters"
        error={errors.password?.message}
        {...register('password')}
      />

      <label className="flex items-start gap-2 text-sm text-neutral-600">
        <input type="checkbox" className="mt-1" {...register('agree')} />
        <span>
          I agree to the{' '}
          <Link href="/terms" className="text-primary-600 hover:underline" target="_blank">Terms of Service</Link>
          {' '}and{' '}
          <Link href="/privacy" className="text-primary-600 hover:underline" target="_blank">Privacy Policy</Link>
          . Subscriptions are billed in USD and auto-renew until canceled. See{' '}
          <Link href="/refunds" className="text-primary-600 hover:underline" target="_blank">refunds &amp; cancellation</Link>.
        </span>
      </label>
      {errors.agree && <p className="text-xs text-danger-700">{errors.agree.message}</p>}

      <Button type="submit" loading={isSubmitting} size="lg" className="mt-1 w-full" variant="gold">
        Create workspace
      </Button>

      <p className="text-center text-sm text-neutral-500">
        Already have an account?{' '}
        <Link href="/login" className="text-primary-600 hover:underline">Sign in</Link>
      </p>
    </form>
  )
}
