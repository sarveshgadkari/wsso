'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { addClient, updateClient } from '@/lib/actions/clients'
import { useToast } from '@/lib/store/toast'
import type { Client, Company } from '@/lib/types'

const schema = z.object({
  name:          z.string().min(1, 'Client name is required'),
  company_id:    z.string().min(1, 'Select a company'),
  contact_name:  z.string().optional(),
  contact_email: z.string().email('Enter a valid email').optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  status:        z.enum(['active', 'inactive']).optional(),
})
type FormValues = z.infer<typeof schema>

interface Props {
  open:      boolean
  onClose:   () => void
  onSaved:   (client: Client) => void
  client?:   Client | null
  companies: Pick<Company, 'id' | 'name' | 'code'>[]
}

export function ClientDialog({ open, onClose, onSaved, client, companies }: Props) {
  const toast    = useToast()
  const isEdit   = !!client

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (open) {
      reset(
        client
          ? {
              name:          client.name,
              company_id:    client.company_id,
              contact_name:  client.contact_name  ?? '',
              contact_email: client.contact_email ?? '',
              contact_phone: client.contact_phone ?? '',
              status:        client.status,
            }
          : { status: 'active' },
      )
    }
  }, [open, client, reset])

  const onSubmit = async (values: FormValues) => {
    const payload = {
      name:          values.name,
      company_id:    values.company_id,
      contact_name:  values.contact_name  || null,
      contact_email: values.contact_email || null,
      contact_phone: values.contact_phone || null,
    }

    const res = isEdit
      ? await updateClient(client!.id, { ...payload, status: values.status })
      : await addClient(payload)

    if (res.error) { setError('root', { message: res.error }); return }

    onSaved(res.data as Client)
    toast.success(isEdit ? 'Client updated' : 'Client created')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit client' : 'New client'}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {errors.root && (
          <div className="rounded-md border border-danger-500/30 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {errors.root.message}
          </div>
        )}

        <Input
          label="Client name"
          placeholder="Acme Corporation"
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

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Contact name"
            placeholder="Jane Smith"
            error={errors.contact_name?.message}
            {...register('contact_name')}
          />
          <Input
            label="Contact phone"
            type="tel"
            placeholder="+1 555 000 0000"
            error={errors.contact_phone?.message}
            {...register('contact_phone')}
          />
        </div>

        <Input
          label="Contact email"
          type="email"
          placeholder="jane@acme.com"
          error={errors.contact_email?.message}
          {...register('contact_email')}
        />

        {isEdit && (
          <Select
            label="Status"
            error={errors.status?.message}
            {...register('status')}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        )}

        <DialogFooter>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create client'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
