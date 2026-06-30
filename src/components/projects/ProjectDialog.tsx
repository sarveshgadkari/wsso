'use client'

import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { addProject, updateProject } from '@/lib/actions/projects'
import { useToast } from '@/lib/store/toast'
import type { Company, Client, Profile } from '@/lib/types'

const schema = z.object({
  name:       z.string().min(1, 'Project name is required'),
  company_id: z.string().min(1, 'Select a company'),
  client_id:  z.string().optional(),
  manager_id: z.string().optional(),
  status:     z.enum(['active', 'on_hold', 'completed']),
})
type FormValues = z.infer<typeof schema>

export interface ProjectRow {
  id:         string
  code:       string
  name:       string
  company_id: string
  client_id:  string | null
  manager_id: string | null
  status:     'active' | 'on_hold' | 'completed'
  created_at: string
  company:    Pick<Company, 'id' | 'name' | 'code'> | null
  client:     Pick<Client,  'id' | 'name' | 'code'> | null
  manager:    Pick<Profile, 'id' | 'full_name' | 'employee_code'> | null
}

interface Props {
  open:      boolean
  onClose:   () => void
  onSaved:   (project: ProjectRow) => void
  project?:  ProjectRow | null
  companies: Pick<Company, 'id' | 'name' | 'code'>[]
  clients:   (Pick<Client,  'id' | 'name' | 'code'> & { company_id: string })[]
  managers:  Pick<Profile,  'id' | 'full_name' | 'employee_code'>[]
  isAdmin:   boolean
  currentUserId: string
}

export function ProjectDialog({
  open, onClose, onSaved, project, companies, clients, managers, isAdmin, currentUserId,
}: Props) {
  const toast   = useToast()
  const isEdit  = !!project

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const watchedCompany = watch('company_id')

  // Filter clients to the selected company
  const companyClients = useMemo(
    () => clients.filter((c) => c.company_id === watchedCompany),
    [clients, watchedCompany],
  )

  // Clear client selection when company changes
  useEffect(() => {
    setValue('client_id', '')
  }, [watchedCompany, setValue])

  useEffect(() => {
    if (open) {
      reset(
        project
          ? {
              name:       project.name,
              company_id: project.company_id,
              client_id:  project.client_id  ?? '',
              manager_id: project.manager_id ?? '',
              status:     project.status,
            }
          : {
              status:     'active',
              manager_id: isAdmin ? '' : currentUserId,
            },
      )
    }
  }, [open, project, isAdmin, currentUserId, reset])

  const onSubmit = async (values: FormValues) => {
    const payload = {
      name:       values.name,
      company_id: values.company_id,
      client_id:  values.client_id  || null,
      manager_id: values.manager_id || null,
      status:     values.status,
    }

    const res = isEdit
      ? await updateProject(project!.id, payload)
      : await addProject(payload)

    if (res.error) { setError('root', { message: res.error }); return }

    // Denorm company/client/manager for the returned row
    const company = companies.find((c) => c.id === res.data!.company_id) ?? null
    const client  = clients.find((c) => c.id === res.data!.client_id)   ?? null
    const manager = managers.find((m) => m.id === res.data!.manager_id) ?? null

    onSaved({ ...(res.data as ProjectRow), company, client, manager })
    toast.success(isEdit ? 'Project updated' : 'Project created')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit project' : 'New project'}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {errors.root && (
          <div className="rounded-md border border-danger-500/30 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {errors.root.message}
          </div>
        )}

        <Input
          label="Project name"
          placeholder="Website Redesign Q3"
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
          label="Client (optional)"
          placeholder="— no client —"
          disabled={!watchedCompany}
          error={errors.client_id?.message}
          {...register('client_id')}
        >
          {companyClients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.name}
            </option>
          ))}
        </Select>
        {watchedCompany && companyClients.length === 0 && (
          <p className="text-xs text-neutral-400">No clients for this company yet.</p>
        )}

        {isAdmin ? (
          <Select
            label="Manager"
            placeholder="— no manager —"
            error={errors.manager_id?.message}
            {...register('manager_id')}
          >
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.full_name} ({m.employee_code})
              </option>
            ))}
          </Select>
        ) : (
          /* Managers always own their own projects — show as read-only */
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-neutral-700">Manager</span>
            <p className="text-sm text-neutral-600">
              {managers.find((m) => m.id === currentUserId)?.full_name ?? 'You'}
            </p>
            <p className="text-xs text-neutral-400">
              You are automatically set as manager for projects you create.
            </p>
          </div>
        )}

        <Select
          label="Status"
          error={errors.status?.message}
          {...register('status')}
        >
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="completed">Completed</option>
        </Select>

        <DialogFooter>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create project'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
