'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Company } from '@/lib/types'
import type { CompanyInput } from '@/lib/actions/companies'

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), 'Enter a valid email')

const schema = z.object({
  name:             z.string().min(1, 'Company name is required').max(120),
  ein_number:       z.string().max(32).optional(),
  physical_address: z.string().max(500).optional(),
  mailing_address:  z.string().max(500).optional(),
  phone:            z.string().max(40).optional(),
  email:            optionalEmail,
})
type FormValues = z.infer<typeof schema>

interface CompanyDialogProps {
  open:      boolean
  onClose:   () => void
  onSave:    (values: CompanyInput) => Promise<string | null>
  company?:  Company | null
}

export function CompanyDialog({ open, onClose, onSave, company }: CompanyDialogProps) {
  const isEdit = !!company

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    reset({
      name:             company?.name ?? '',
      ein_number:       company?.ein_number ?? '',
      physical_address: company?.physical_address ?? '',
      mailing_address:  company?.mailing_address ?? '',
      phone:            company?.phone ?? '',
      email:            company?.email ?? '',
    })
  }, [company, open, reset])

  const onSubmit = async (values: FormValues) => {
    const payload: CompanyInput = {
      name:             values.name.trim(),
      ein_number:       values.ein_number?.trim() || null,
      physical_address: values.physical_address?.trim() || null,
      mailing_address:  values.mailing_address?.trim() || null,
      phone:            values.phone?.trim() || null,
      email:            values.email?.trim() || null,
    }
    const err = await onSave(payload)
    if (err) {
      setError('root', { message: err })
      return
    }
    onClose()
  }

  const textareaClass =
    'w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 ' +
    'placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 ' +
    'focus:ring-primary-500 resize-none'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Company' : 'New Company'}
      description={isEdit ? `Editing ${company?.code}` : 'The company code is auto-generated.'}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {errors.root && (
          <p className="rounded-md bg-danger-50 border border-danger-500/30 px-3 py-2 text-sm text-danger-700">
            {errors.root.message}
          </p>
        )}

        {isEdit && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-neutral-500">Company code</span>
            <span className="font-mono text-sm font-semibold text-neutral-700">
              {company?.code}
            </span>
          </div>
        )}

        <Input
          label="Company name *"
          placeholder="e.g. Acme Corp"
          autoFocus
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="EIN Number"
          placeholder="e.g. 12-3456789"
          error={errors.ein_number?.message}
          {...register('ein_number')}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Physical Address</label>
          <textarea
            rows={2}
            placeholder="Street, city, state, ZIP"
            className={textareaClass}
            {...register('physical_address')}
          />
          {errors.physical_address && (
            <p className="text-xs text-danger-600">{errors.physical_address.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Mailing Address</label>
          <textarea
            rows={2}
            placeholder="Street, city, state, ZIP (if different)"
            className={textareaClass}
            {...register('mailing_address')}
          />
          {errors.mailing_address && (
            <p className="text-xs text-danger-600">{errors.mailing_address.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Phone Number"
            placeholder="e.g. (555) 123-4567"
            error={errors.phone?.message}
            {...register('phone')}
          />
          <Input
            label="Email Address"
            type="email"
            placeholder="e.g. info@company.com"
            error={errors.email?.message}
            {...register('email')}
          />
        </div>

        <DialogFooter>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create company'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
