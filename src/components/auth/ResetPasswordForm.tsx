'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Include at least one uppercase letter')
      .regex(/[0-9]/, 'Include at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type FormValues = z.infer<typeof schema>

export function ResetPasswordForm() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [hasSession, setHasSession] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let found = false

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled || !session) return
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        found = true
        setHasSession(true)
        setReady(true)
      }
    })

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      if (session) {
        found = true
        setHasSession(true)
        setReady(true)
        return
      }
      // Hash tokens from implicit-flow emails arrive after the first paint
      window.setTimeout(() => {
        if (cancelled || found) return
        setHasSession(false)
        setReady(true)
      }, 400)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const onSubmit = async (values: FormValues) => {
    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({
      password: values.password,
    })

    if (error) {
      setError('root', { message: error.message })
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  if (!ready) {
    return (
      <p className="text-center text-sm text-neutral-500">Checking your reset link…</p>
    )
  }

  if (!hasSession) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm font-medium text-neutral-800">This reset link is invalid or has expired.</p>
        <p className="text-sm text-neutral-500">
          Request a new one from the login page. Links expire after about an hour.
        </p>
        <Link href="/forgot-password" className="text-sm text-primary-600 hover:underline">
          Request a new reset link
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      {errors.root && (
        <div className="rounded-md bg-danger-50 border border-danger-500/30 px-4 py-3">
          <p className="text-sm text-danger-700">{errors.root.message}</p>
        </div>
      )}

      <Input
        label="New password"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        hint="At least 8 characters, one uppercase letter, one number."
        error={errors.password?.message}
        {...register('password')}
      />

      <Input
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      <Button type="submit" loading={isSubmitting} size="lg" className="w-full mt-1">
        Set new password
      </Button>
    </form>
  )
}
