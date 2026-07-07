'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/lib/store/toast'
import { createTactic, updateTactic } from '@/lib/actions/tactics'
import type { Tactic, TacticPriority } from '@/lib/types'

// Rich row type with denormalised joins — used across Tactics & Kanban
export interface TacticRow extends Tactic {
  project:  { id: string; name: string; code: string } | null
  assignee: { id: string; full_name: string; employee_code: string } | null
  creator:  { id: string; full_name: string; employee_code: string } | null
}

export type EmployeeOption = { id: string; full_name: string; employee_code: string }
export type ProjectOption  = { id: string; name: string; code: string }

interface Props {
  open:      boolean
  onClose:   () => void
  onSaved:   (t: TacticRow) => void
  tactic?:   TacticRow | null
  employees: EmployeeOption[]
  projects:  ProjectOption[]
  isAdmin:   boolean
  currentUserId: string
}

const schema = z.object({
  title:           z.string().min(1, 'Title is required').max(200),
  description:     z.string().optional(),
  training_notes:  z.string().optional(),
  training_link:   z.string().trim().url('Enter a valid URL').optional().or(z.literal('')),
  project_id:      z.string().optional(),
  assigned_to:     z.string().min(1, 'Select an employee'),
  priority:        z.enum(['low', 'medium', 'high', 'critical']),
  due_date:        z.string().optional(),
  estimated_hours: z.coerce.number().positive().max(9999).optional().or(z.literal('')),
})
type FormValues = z.infer<typeof schema>

const PRIORITY_OPTIONS: { value: TacticPriority; label: string }[] = [
  { value: 'low',      label: 'Low' },
  { value: 'medium',   label: 'Medium' },
  { value: 'high',     label: 'High' },
  { value: 'critical', label: 'Critical' },
]

export function TacticDialog({
  open, onClose, onSaved, tactic, employees, projects, currentUserId,
}: Props) {
  const toast  = useToast()
  const isEdit = !!tactic

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'medium' },
  })

  useEffect(() => {
    if (open) {
      reset(
        tactic
          ? {
              title:           tactic.title,
              description:     tactic.description     ?? '',
              training_notes:  tactic.training_notes   ?? '',
              training_link:   tactic.training_link    ?? '',
              project_id:      tactic.project_id      ?? '',
              assigned_to:     tactic.assigned_to,
              priority:        tactic.priority,
              due_date:        tactic.due_date         ?? '',
              estimated_hours: tactic.estimated_hours  !== null && tactic.estimated_hours !== undefined
                                 ? Number(tactic.estimated_hours)
                                 : ('' as unknown as number),
            }
          : {
              priority: 'medium', title: '', description: '', training_notes: '', training_link: '',
              project_id: '', assigned_to: '', due_date: '', estimated_hours: '' as unknown as number,
            },
      )
    }
  }, [open, tactic, reset])

  async function onSubmit(values: FormValues) {
    try {
      const payload = {
        title:           values.title,
        description:     values.description     || null,
        training_notes:  values.training_notes  || null,
        training_link:   values.training_link    || null,
        project_id:      values.project_id      || null,
        assigned_to:     values.assigned_to,
        priority:        values.priority,
        due_date:        values.due_date         || null,
        estimated_hours: values.estimated_hours && values.estimated_hours !== ('' as unknown as number)
                           ? Number(values.estimated_hours)
                           : null,
      }

      const saved = isEdit
        ? await updateTactic(tactic!.id, payload)
        : await createTactic(payload)

      // Denormalise for optimistic UI
      const emp  = employees.find(e => e.id === payload.assigned_to)
      const proj = projects.find(p => p.id === payload.project_id)

      const row: TacticRow = {
        ...saved,
        project:  proj ?? null,
        assignee: emp  ?? { id: payload.assigned_to, full_name: '—', employee_code: '—' },
        creator:  tactic?.creator ?? { id: currentUserId, full_name: '—', employee_code: '—' },
      }

      toast.success(isEdit ? 'Work order updated' : 'Work order created')
      onSaved(row)
    } catch (err) {
      setError('root', { message: err instanceof Error ? err.message : 'Something went wrong' })
    }
  }

  const textareaClass =
    'w-full rounded border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 ' +
    'placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-2 ' +
    'focus:ring-primary-500 resize-none disabled:bg-neutral-50 disabled:text-neutral-500'

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit work order' : 'New work order'}
      size="xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {errors.root && (
          <div className="rounded-md border border-danger-500/30 bg-danger-50 px-3 py-2 text-sm text-danger-700">
            {errors.root.message}
          </div>
        )}

        <Input
          label="Title *"
          placeholder="Work order title"
          error={errors.title?.message}
          {...register('title')}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Description</label>
          <textarea
            rows={4}
            placeholder="Optional description…"
            className={textareaClass}
            {...register('description')}
          />
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Training (optional)
          </label>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700">Training task</label>
            <textarea
              rows={3}
              placeholder="What should the employee learn or review before starting?"
              className={textareaClass}
              {...register('training_notes')}
            />
          </div>
          <Input
            label="Training link"
            placeholder="https://…"
            error={errors.training_link?.message}
            {...register('training_link')}
          />
        </div>

        <Select
          label="Project"
          placeholder="— No project —"
          {...register('project_id')}
        >
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
          ))}
        </Select>

        <Select
          label="Assigned to *"
          placeholder="— Select employee —"
          error={errors.assigned_to?.message}
          {...register('assigned_to')}
        >
          {employees.map(e => (
            <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>
          ))}
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Select
            label="Priority *"
            error={errors.priority?.message}
            {...register('priority')}
          >
            {PRIORITY_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </Select>

          <Input
            label="Due date"
            type="date"
            {...register('due_date')}
          />
        </div>

        <Input
          label="Estimated hours"
          type="number"
          step="0.5"
          min="0.5"
          max="9999"
          placeholder="e.g. 8"
          error={errors.estimated_hours?.message}
          {...register('estimated_hours')}
        />

        <DialogFooter>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create work order'}
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
