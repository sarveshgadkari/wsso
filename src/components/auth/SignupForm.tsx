'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

const schema = z.object({
  workspace_name: z.string().min(2, 'Workspace name is required'),
  full_name:      z.string().min(1, 'Your name is required'),
  email:          z.string().email('Enter a valid email'),
  password:       z.string().min(8, 'At least 8 characters'),
})

type FormValues = z.infer<typeof schema>

export function SignupForm() {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    })
    const json = await res.json().catch(() => ({})) as { error?: string }

    if (!res.ok) {
      setError('root', { message: json.error ?? 'Could not create workspace' })
      return
    }

    router.push('/login?signup=1')
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      {errors.root && (
        <div className="rounded-md border border-danger-500/30 bg-danger-50 px-4 py-3">
          <p className="text-sm text-danger-700">{errors.root.message}</p>
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

      <Button type="submit" loading={isSubmitting} size="lg" className="mt-1 w-full">
        Create workspace
      </Button>

      <p className="text-center text-xs text-neutral-500">
        14-day trial · 10 seats · no card required
      </p>
      <p className="text-center text-sm text-neutral-500">
        Already have an account?{' '}
        <Link href="/login" className="text-primary-600 hover:underline">Sign in</Link>
      </p>
    </form>
  )
}
