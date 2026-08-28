'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { createOrganization } from '@/lib/actions/platform'
import { useToast } from '@/lib/store/toast'
import { formatUsd } from '@/lib/saas/plans'
import type { SubscriptionPlan } from '@/lib/types'

const schema = z.object({
  name:            z.string().min(2, 'Workspace name is required'),
  plan_id:         z.string().uuid('Select a plan'),
  admin_full_name: z.string().min(1, 'Admin name is required'),
  admin_email:     z.string().email('Admin email is required'),
  start_trial:     z.boolean(),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open: boolean
  onClose: () => void
  plans: SubscriptionPlan[]
}

export function CreateOrgDialog({ open, onClose, plans }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const defaultPlan = plans[0]?.id ?? ''

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { plan_id: defaultPlan, start_trial: true },
  })

  const onSubmit = async (values: FormValues) => {
    setBusy(true)
    const result = await createOrganization(values)
    setBusy(false)

    if ('error' in result && result.error) {
      setError('name', { message: result.error })
      return
    }

    const warning = 'warning' in result ? result.warning : undefined
    toast.success(warning || 'Workspace created. Invite email sent to their admin.')
    reset({ plan_id: defaultPlan, start_trial: true })
    onClose()
    if ('data' in result && result.data) router.push(`/platform/organizations/${result.data.id}`)
    else router.refresh()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New customer workspace"
      description="Create the company and invite their admin. That admin pays for the whole workspace."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Input label="Company / workspace name" placeholder="Acme Inc" error={errors.name?.message} {...register('name')} />
        <Select label="Subscription plan" error={errors.plan_id?.message} {...register('plan_id')}>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {formatUsd(p.monthly_price_cents)}/mo · {p.seat_limit} seats
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input type="checkbox" className="rounded border-neutral-300" {...register('start_trial')} />
          Start with plan trial days (admin pays before trial ends)
        </label>
        <div className="border-t border-neutral-100 pt-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Workspace admin login
          </p>
          <div className="flex flex-col gap-3">
            <Input label="Admin name" placeholder="Jane Doe" error={errors.admin_full_name?.message} {...register('admin_full_name')} />
            <Input label="Admin email" type="email" placeholder="jane@acme.com" error={errors.admin_email?.message} {...register('admin_email')} />
          </div>
          <p className="mt-2 text-xs text-neutral-500">
            They receive a set-password email and sign in as Admin. Only Admin sees Billing and pays for the whole company.
          </p>
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy}>Create and invite</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
