'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import type { Company, Profile } from '@/lib/types'

export interface TeamRow {
  id:         string
  code:       string
  name:       string
  company_id: string
  manager_id: string | null
  created_at: string
  company:    Pick<Company, 'id' | 'name' | 'code'> | null
  manager:    Pick<Profile, 'id' | 'full_name' | 'employee_code'> | null
}

const schema = z.object({
  name:       z.string().min(1, 'Team name is required').max(100),
  company_id: z.string().min(1, 'Select a company'),
  manager_id: z.string().optional().nullable(),
})
type FormValues = z.infer<typeof schema>

interface TeamDialogProps {
  open:      boolean
  onClose:   () => void
  onSave:    (values: FormValues) => Promise<string | null>
  team?:     TeamRow | null
  companies: Pick<Company, 'id' | 'name' | 'code'>[]
  managers:  Pick<Profile, 'id' | 'full_name' | 'employee_code'>[]
}

export function TeamDialog({ open, onClose, onSave, team, companies, managers }: TeamDialogProps) {
  const isEdit = !!team

  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    reset({
      name:       team?.name       ?? '',
      company_id: team?.company_id ?? '',
      manager_id: team?.manager_id ?? '',
    })
  }, [team, open, reset])

  const onSubmit = async (values: FormValues) => {
    const err = await onSave({
      ...values,
      manager_id: values.manager_id || null,
    })
    if (err) { setError('root', { message: err }); return }
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit Team' : 'New Team'}
      description={isEdit ? `Code: ${team?.code}` : 'Code is auto-generated (TM001…)'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {errors.root && (
          <p className="rounded-md bg-danger-50 border border-danger-500/30 px-3 py-2 text-sm text-danger-700">
            {errors.root.message}
          </p>
        )}

        <Input
          label="Team name"
          placeholder="e.g. Development Squad"
          autoFocus
          error={errors.name?.message}
          {...register('name')}
        />

        <Select
          label="Company"
          placeholder="— select company —"
          error={errors.company_id?.message}
          {...register('company_id')}
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </Select>

        <Select
          label="Team manager"
          placeholder="— no manager yet —"
          hint="Only users with the Manager role are listed."
          error={errors.manager_id?.message}
          {...register('manager_id')}
        >
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name} ({m.employee_code})
            </option>
          ))}
        </Select>

        <DialogFooter>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create team'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
