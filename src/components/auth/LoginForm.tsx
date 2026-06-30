'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

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
      setError('root', {
        message:
          error.message === 'Invalid login credentials'
            ? 'Incorrect email or password.'
            : error.message,
      })
      return
    }

    // Check that the account is still active before proceeding
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('status')
        .eq('id', user.id)
        .single()

      if (profileRow?.status === 'inactive') {
        await supabase.auth.signOut()
        setError('root', {
          message: 'Your account has been deactivated. Contact your administrator.',
        })
        return
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
    </form>
  )
}
