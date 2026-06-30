'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

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
