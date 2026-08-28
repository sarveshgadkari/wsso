'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { isSignupEnabled } from '@/lib/saas/plans'

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
})

type FormValues = z.infer<typeof schema>

export function LoginForm() {
  const router = useRouter()

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email:    values.email,
      password: values.password,
    })

    if (error) {
      const isInvalidCredentials = error.message === 'Invalid login credentials'
      setError('root', {
        message: isInvalidCredentials
          ? 'Incorrect email or password. If you were just invited, open the set-password email first, then sign in.'
          : error.message,
      })
      return
    }

    // Check that the account is still active before proceeding
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('status, role, organization_id')
        .eq('id', user.id)
        .single()

      if (profileRow?.status === 'inactive') {
        await supabase.auth.signOut()
        setError('root', {
          message: 'Your account has been deactivated. Contact your administrator.',
        })
        return
      }

      if (profileRow?.role === 'super_admin') {
        router.push('/platform')
        router.refresh()
        return
      }

      if (profileRow?.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('status, trial_ends_at')
          .eq('id', profileRow.organization_id)
          .single()

        if (org?.status === 'suspended' || org?.status === 'cancelled') {
          await supabase.auth.signOut()
          setError('root', {
            message: 'This workspace is suspended. Contact support.',
          })
          return
        }
      }
    }

    // Force a full route refresh so server components re-read the new session
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {/* Root / server error */}
      {errors.root && (
        <div className="rounded-md bg-danger-50 border border-danger-500/30 px-4 py-3">
          <p className="text-sm text-danger-700">{errors.root.message}</p>
        </div>
      )}

      <Input
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        error={errors.email?.message}
        {...register('email')}
      />

      <div className="flex flex-col gap-1">
        <Input
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="flex justify-end">
          <Link
            href="/forgot-password"
            className="text-xs text-primary-600 hover:text-primary-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>
      </div>

      <Button type="submit" loading={isSubmitting} size="lg" className="w-full mt-1">
        Sign in
      </Button>

      {isSignupEnabled() && (
        <p className="text-center text-sm text-neutral-500">
          New customer?{' '}
          <Link href="/signup" className="text-primary-600 hover:underline">
            Create a workspace
          </Link>
        </p>
      )}
    </form>
  )
}
