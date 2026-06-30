'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Company } from '@/lib/types'

const schema = z.object({
  name: z.string().min(1, 'Company name is required').max(120),
})
type FormValues = z.infer<typeof schema>

interface CompanyDialogProps {
  open:      boolean
  onClose:   () => void
  onSave:    (values: FormValues) => Promise<string | null>  // returns error or null
  company?:  Company | null   // null = create mode
}

export function CompanyDialog({ open, onClose, onSave, company }: CompanyDialogProps) {
  const isEdit = !!company

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) })

  // Populate form when editing
  useEffect(() => {
    reset({ name: company?.name ?? '' })
  }, [company, open, reset])

  const onSubmit = async (values: FormValues) => {
    const err = await onSave(values)
    if (err) {
      setError('root', { message: err })
      return
    }
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Company' : 'New Company'}
      description={isEdit ? `Editing ${company?.code}` : 'The company code is auto-generated.'}
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
          label="Company name"
          placeholder="e.g. Acme Corp"
          autoFocus
          error={errors.name?.message}
          {...register('name')}
        />

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
