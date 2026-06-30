'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { updateEmployeeOrg } from '@/lib/actions/org'
import type { Company, Profile } from '@/lib/types'
import type { TeamRow } from '@/components/teams/TeamDialog'

export interface EmployeeOrgRow extends Profile {
  currentCompanyIds: string[]
}

const schema = z.object({
  team_id:     z.string().nullable(),
  manager_id:  z.string().nullable(),
  company_ids: z.array(z.string()),
})
type FormValues = z.infer<typeof schema>

interface OrgAssignmentDialogProps {
  open:      boolean
  onClose:   () => void
  onSaved:   (updated: EmployeeOrgRow) => void
  employee:  EmployeeOrgRow | null
  teams:     Pick<TeamRow, 'id' | 'name' | 'code' | 'manager_id'>[]
  managers:  Pick<Profile, 'id' | 'full_name' | 'employee_code'>[]
  companies: Pick<Company, 'id' | 'name' | 'code'>[]
}

export function OrgAssignmentDialog({
  open, onClose, onSaved, employee, teams, managers, companies,
}: OrgAssignmentDialogProps) {
  const [serverError, setServerError] = useState<string | null>(null)

  const { register, handleSubmit, reset, control, setValue, watch, formState: { isSubmitting } } =
    useForm<FormValues>({ resolver: zodResolver(schema) })

  const watchedTeamId = watch('team_id')

  // Populate from employee
  useEffect(() => {
    if (!employee) return
    reset({
      team_id:     employee.team_id    ?? null,
      manager_id:  employee.manager_id ?? null,
      company_ids: employee.currentCompanyIds,
    })
    setServerError(null)
  }, [employee, open, reset])

  // When team changes, auto-fill manager from that team's manager
  useEffect(() => {
    if (!watchedTeamId) return
    const team = teams.find((t) => t.id === watchedTeamId)
    if (team?.manager_id) {
      setValue('manager_id', team.manager_id, { shouldDirty: true })
    }
  }, [watchedTeamId, teams, setValue])

  const onSubmit = async (values: FormValues) => {
    if (!employee) return
    setServerError(null)
    const res = await updateEmployeeOrg({
      employee_id: employee.id,
      team_id:     values.team_id     || null,
      manager_id:  values.manager_id  || null,
      company_ids: values.company_ids,
    })
    if (res.error) { setServerError(res.error); return }
    onSaved({
      ...employee,
      team_id:           values.team_id     || null,
      manager_id:        values.manager_id  || null,
      currentCompanyIds: values.company_ids,
    })
    onClose()
  }

  if (!employee) return null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit Org Assignment"
      description={`${employee.full_name} · ${employee.employee_code}`}
      size="lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
        {serverError && (
          <p className="rounded-md bg-danger-50 border border-danger-500/30 px-3 py-2 text-sm text-danger-700">
            {serverError}
          </p>
        )}

        {/* Team */}
        <Select
          label="Team"
          placeholder="— no team —"
          hint="Changing the team will auto-fill the manager below."
          {...register('team_id')}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.code} — {t.name}
              {!t.manager_id ? ' ⚠ no manager' : ''}
            </option>
          ))}
        </Select>

        {/* Direct manager (can differ from team's manager for edge cases) */}
        <Select
          label="Direct manager"
          placeholder="— no direct manager —"
          hint="Auto-filled from the team's manager; override here for director-level employees."
          {...register('manager_id')}
        >
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.full_name} ({m.employee_code})
            </option>
          ))}
        </Select>

        {/* Company multi-select via checkboxes */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-neutral-700">
            Linked companies
          </span>
          <p className="text-xs text-neutral-500">
            This controls which companies the employee can access via their RLS policies.
          </p>
          <div className="mt-1.5 max-h-44 overflow-y-auto rounded-md border border-neutral-200 divide-y divide-neutral-100">
            <Controller
              name="company_ids"
              control={control}
              render={({ field }) => (
                <>
                  {companies.map((c) => {
                    const checked = field.value.includes(c.id)
                    return (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-neutral-50 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? field.value.filter((id) => id !== c.id)
                              : [...field.value, c.id]
                            field.onChange(next)
                          }}
                          className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="font-mono text-xs text-neutral-400 w-14">{c.code}</span>
                        <span className="text-sm text-neutral-800">{c.name}</span>
                      </label>
                    )
                  })}
                </>
              )}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Save assignment</Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
