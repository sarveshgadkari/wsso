'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { createLead } from '@/lib/actions/leads'

const schema = z.object({
  first_name:   z.string().min(1, 'First name is required').max(80),
  last_name:    z.string().min(1, 'Last name is required').max(80),
  email:        z.string().email('Enter a valid email').max(200),
  company:      z.string().max(200).optional(),
  inquiry_type: z.string().max(120).optional(),
  message:      z.string().max(5000).optional(),
})

type FormValues = z.infer<typeof schema>

export function AddLeadDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  async function onSubmit(values: FormValues) {
    try {
      await createLead({
        first_name:   values.first_name.trim(),
        last_name:    values.last_name.trim(),
        email:        values.email.trim(),
        company:      values.company?.trim() || null,
        inquiry_type: values.inquiry_type?.trim() || null,
        message:      values.message?.trim() || null,
        source:       'dashboard',
      })
      reset()
      onSaved()
      onClose()
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Could not add lead',
      })
    }
  }

  const textareaClass =
    'w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 ' +
    'placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 ' +
    'focus:ring-primary-500 resize-none'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add lead"
      description="Add a contact from the dashboard. You can assign them after they appear in CRM."
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {errors.root && (
          <p className="rounded-md border border-danger-500/30 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {errors.root.message}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="First name *" error={errors.first_name?.message} {...register('first_name')} />
          <Input label="Last name *" error={errors.last_name?.message} {...register('last_name')} />
        </div>
        <Input label="Email *" type="email" error={errors.email?.message} {...register('email')} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Company" error={errors.company?.message} {...register('company')} />
          <Input label="Inquiry type" error={errors.inquiry_type?.message} {...register('inquiry_type')} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Notes</label>
          <textarea rows={3} className={textareaClass} placeholder="Optional" {...register('message')} />
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Add lead
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
