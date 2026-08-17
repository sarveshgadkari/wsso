'use client'

import { useEffect, useState } from 'react'
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
  project:   { id: string; name: string; code: string } | null
  assignee:  { id: string; full_name: string; employee_code: string } | null
  creator:   { id: string; full_name: string; employee_code: string } | null
  /** All people on this work order (includes primary assignee). */
  assignees?: { id: string; full_name: string; employee_code: string }[]
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
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const [assigneeError, setAssigneeError] = useState<string | null>(null)

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
      const existing =
        tactic?.assignees?.map(a => a.id)
        ?? (tactic?.assigned_to ? [tactic.assigned_to] : [])

      setAssigneeIds(existing)
      setAssigneeError(null)

      reset(
        tactic
          ? {
              title:           tactic.title,
              description:     tactic.description     ?? '',
              training_notes:  tactic.training_notes   ?? '',
              training_link:   tactic.training_link    ?? '',
              project_id:      tactic.project_id      ?? '',
              priority:        tactic.priority,
              due_date:        tactic.due_date         ?? '',
              estimated_hours: tactic.estimated_hours  !== null && tactic.estimated_hours !== undefined
                                 ? Number(tactic.estimated_hours)
                                 : ('' as unknown as number),
            }
          : {
              priority: 'medium', title: '', description: '', training_notes: '', training_link: '',
              project_id: '', due_date: '', estimated_hours: '' as unknown as number,
            },
      )
    }
  }, [open, tactic, reset])

  function toggleAssignee(id: string) {
    setAssigneeError(null)
    setAssigneeIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    )
  }

  async function onSubmit(values: FormValues) {
    if (assigneeIds.length === 0) {
      setAssigneeError('Select at least one person')
      return
    }

    const primary = assigneeIds[0]

    try {
      const payload = {
        title:           values.title,
        description:     values.description     || null,
        training_notes:  values.training_notes  || null,
        training_link:   values.training_link    || null,
        project_id:      values.project_id      || null,
        assigned_to:     primary,
        assignee_ids:    assigneeIds,
        priority:        values.priority,
        due_date:        values.due_date         || null,
        estimated_hours: values.estimated_hours && values.estimated_hours !== ('' as unknown as number)
                           ? Number(values.estimated_hours)
                           : null,
      }

      const saved = isEdit
        ? await updateTactic(tactic!.id, payload)
        : await createTactic(payload)

      const selectedPeople = assigneeIds
        .map(id => employees.find(e => e.id === id) ?? { id, full_name: '—', employee_code: '—' })
      const emp  = selectedPeople[0]
      const proj = projects.find(p => p.id === payload.project_id)

      const row: TacticRow = {
        ...saved,
        project:   proj ?? null,
        assignee:  emp,
        assignees: selectedPeople,
        creator:   tactic?.creator ?? { id: currentUserId, full_name: '—', employee_code: '—' },
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

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Assignment Instructions</label>
          <textarea
            rows={4}
            placeholder="Optional assignment instructions…"
            className={textareaClass}
            {...register('description')}
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

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-neutral-700">
            Assign to * <span className="font-normal text-neutral-500">(select one or more)</span>
          </label>
          <div className="max-h-48 overflow-y-auto rounded-md border border-neutral-300 bg-white p-2">
            {employees.length === 0 ? (
              <p className="px-1 py-2 text-sm text-neutral-400">No employees available</p>
            ) : (
              <ul className="space-y-1">
                {employees.map(e => {
                  const checked = assigneeIds.includes(e.id)
                  const isPrimary = checked && assigneeIds[0] === e.id
                  return (
                    <li key={e.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-neutral-50">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                          checked={checked}
                          onChange={() => toggleAssignee(e.id)}
                        />
                        <span className="flex-1 text-sm text-neutral-800">
                          {e.full_name}{' '}
                          <span className="text-neutral-400">({e.employee_code})</span>
                        </span>
                        {isPrimary && (
                          <span className="rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary-700">
                            Primary
                          </span>
                        )}
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
          {assigneeIds.length > 0 && (
            <p className="text-xs text-neutral-500">
              {assigneeIds.length} selected. First checked person is primary for reports; everyone
              shares the same work order.
            </p>
          )}
          {assigneeError && (
            <p className="text-xs text-danger-600">{assigneeError}</p>
          )}
        </div>

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

/** Display helper for list/detail cells */
export function formatAssignees(t: TacticRow): string {
  const list = t.assignees?.length
    ? t.assignees
    : t.assignee
      ? [t.assignee]
      : []
  if (list.length === 0) return 'Unknown'
  if (list.length === 1) return list[0].full_name
  if (list.length === 2) return `${list[0].full_name}, ${list[1].full_name}`
  return `${list[0].full_name} +${list.length - 1}`
}
