'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { requestPasswordReset } from '@/lib/actions/auth'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CheckCircle } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type FormValues = z.infer<typeof schema>

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    const result = await requestPasswordReset(values.email)

    if (result.error) {
      setError('root', { message: result.error })
      return
    }

    setSent(true)
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle className="h-10 w-10 text-success-500" />
        <div>
          <p className="text-sm font-medium text-neutral-800">Check your inbox</p>
          <p className="mt-1 text-sm text-neutral-500">
            If an account exists for <strong>{getValues('email')}</strong>, we sent a reset link.
            It expires in 1 hour. Check spam if you do not see it.
          </p>
        </div>
        <Link href="/login" className="text-sm text-primary-600 hover:underline">
          Back to sign in
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
        label="Email address"
        type="email"
        autoComplete="email"
        placeholder="you@company.com"
        hint="We'll send a password reset link to this address."
        error={errors.email?.message}
        {...register('email')}
      />

      <Button type="submit" loading={isSubmitting} size="lg" className="w-full mt-1">
        Send reset link
      </Button>

      <p className="text-center text-sm text-neutral-500">
        Remember your password?{' '}
        <Link href="/login" className="text-primary-600 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  )
}
