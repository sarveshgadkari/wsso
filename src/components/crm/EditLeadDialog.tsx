'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { updateLead } from '@/lib/actions/leads'
import { LEAD_STATUS_LABEL } from '@/lib/leads-utils'
import { LEAD_STATUSES } from '@/lib/types'
import type { LeadStatus } from '@/lib/types'
import type { LeadRow } from './LeadsTable'

const schema = z.object({
  first_name:   z.string().min(1, 'First name is required').max(80),
  last_name:    z.string().min(1, 'Last name is required').max(80),
  email:        z.string().email('Enter a valid email').max(200),
  company:      z.string().max(200).optional(),
  inquiry_type: z.string().max(120).optional(),
  message:      z.string().min(1, 'Message is required').max(5000),
  status:       z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']),
})

type FormValues = z.infer<typeof schema>

interface Props {
  lead: LeadRow
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function EditLeadDialog({ lead, open, onClose, onSaved }: Props) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!open) return
    reset({
      first_name:   lead.first_name,
      last_name:    lead.last_name,
      email:        lead.email,
      company:      lead.company ?? '',
      inquiry_type: lead.inquiry_type ?? '',
      message:      lead.message,
      status:       lead.status as LeadStatus,
    })
  }, [open, lead, reset])

  async function onSubmit(values: FormValues) {
    try {
      await updateLead(lead.id, {
        first_name:   values.first_name.trim(),
        last_name:    values.last_name.trim(),
        email:        values.email.trim(),
        company:      values.company?.trim() || null,
        inquiry_type: values.inquiry_type?.trim() || null,
        message:      values.message.trim(),
        status:       values.status,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError('root', {
        message: err instanceof Error ? err.message : 'Failed to save lead',
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
      title="Edit lead"
      description={`${lead.website_name} · received ${new Date(lead.created_at).toLocaleDateString()}`}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {errors.root && (
          <p className="rounded-md border border-danger-500/30 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {errors.root.message}
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="First name *"
            error={errors.first_name?.message}
            {...register('first_name')}
          />
          <Input
            label="Last name *"
            error={errors.last_name?.message}
            {...register('last_name')}
          />
        </div>

        <Input
          label="Email *"
          type="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Company"
            error={errors.company?.message}
            {...register('company')}
          />
          <Input
            label="Inquiry type"
            error={errors.inquiry_type?.message}
            {...register('inquiry_type')}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Message *</label>
          <textarea
            rows={4}
            className={textareaClass}
            {...register('message')}
          />
          {errors.message && (
            <p className="text-xs text-danger-600">{errors.message.message}</p>
          )}
        </div>

        <Select label="Status *" error={errors.status?.message} {...register('status')}>
          {LEAD_STATUSES.map(s => (
            <option key={s} value={s}>{LEAD_STATUS_LABEL[s]}</option>
          ))}
        </Select>

        <p className="text-xs text-neutral-400">
          Website source fields ({lead.website_name}) are read-only — they come from the enquiry form.
        </p>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Save changes
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
