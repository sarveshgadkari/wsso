'use client'

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2 } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/lib/store/toast'
import type { Company, Team, Profile } from '@/lib/types'

const schema = z.object({
  full_name:   z.string().min(1, 'Full name is required'),
  email:       z.string().email('Enter a valid email'),
  phone:       z.string().optional(),
  role:        z.enum(['director', 'manager', 'employee']),
  department:  z.string().optional(),
  team_id:     z.string().optional(),
  manager_id:  z.string().optional(),
  company_ids: z.array(z.string()).min(1, 'Assign at least one company'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  open:      boolean
  onClose:   () => void
  onCreated: (profile: Profile) => void
  teams:     (Pick<Team, 'id' | 'name' | 'code'> & { manager_id: string | null })[]
  managers:  Pick<Profile, 'id' | 'full_name' | 'employee_code'>[]
  companies: Pick<Company, 'id' | 'name' | 'code'>[]
}

interface SuccessState {
  employee_code: string
  full_name:     string
}

export function CreateEmployeeDialog({
  open, onClose, onCreated, teams, managers, companies,
}: Props) {
  const toast = useToast()
  const [success, setSuccess]         = useState<SuccessState | null>(null)
  const [, setSelectedTeamId] = useState('')

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'employee', company_ids: [] },
  })

  const watchedTeamId = watch('team_id')

  // Auto-fill manager when team changes
  useEffect(() => {
    if (!watchedTeamId) return
    const team = teams.find((t) => t.id === watchedTeamId)
    if (team?.manager_id) setValue('manager_id', team.manager_id)
    setSelectedTeamId(watchedTeamId)
  }, [watchedTeamId, teams, setValue])

  const handleClose = () => {
    reset()
    setSuccess(null)
    setSelectedTeamId('')
    onClose()
  }

  const onSubmit = async (values: FormValues) => {
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name:   values.full_name,
        email:       values.email,
        phone:       values.phone || null,
        role:        values.role,
        department:  values.department || null,
        team_id:     values.team_id    || null,
        manager_id:  values.manager_id || null,
        company_ids: values.company_ids,
      }),
    })

    const body = await res.json()

    if (!res.ok) {
      setError('root', { message: body.error ?? 'Failed to create employee' })
      return
    }

    setSuccess({
      employee_code: body.profile.employee_code,
      full_name:     body.profile.full_name,
    })
    onCreated(body.profile)
    toast.success(`Employee ${body.profile.full_name} created`)
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Create employee"
      description="A temporary set-password link will be logged to the console."
      size="lg"
    >
      {success ? (
        /* ── Success state ── */
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <CheckCircle2 className="h-10 w-10 text-success-500" />
          <div>
            <p className="font-semibold text-neutral-900">{success.full_name} created</p>
            <p className="mt-1 text-sm text-neutral-500">Employee code</p>
            <p className="mt-1 font-mono text-xl font-bold text-primary-600">
              {success.employee_code}
            </p>
          </div>
          <p className="text-xs text-neutral-400">
            The set-password link has been logged to the server console.
          </p>
        </div>
      ) : (
        /* ── Form ── */
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          {errors.root && (
            <div className="rounded-md border border-danger-500/30 bg-danger-50 px-3 py-2 text-sm text-danger-700">
              {errors.root.message}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Full name"
              placeholder="Jane Smith"
              error={errors.full_name?.message}
              {...register('full_name')}
            />
            <Input
              label="Email"
              type="email"
              placeholder="jane@company.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="Phone"
              type="tel"
              placeholder="+1 555 000 0000"
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Input
              label="Department"
              placeholder="Marketing"
              error={errors.department?.message}
              {...register('department')}
            />
          </div>

          <Select
            label="Role"
            error={errors.role?.message}
            {...register('role')}
          >
            <option value="director">Director</option>
            <option value="manager">Manager</option>
            <option value="employee">Employee</option>
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Team"
              placeholder="— no team —"
              error={errors.team_id?.message}
              {...register('team_id')}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.code} — {t.name}
                  {!t.manager_id ? ' ⚠' : ''}
                </option>
              ))}
            </Select>

            <Select
              label="Direct manager"
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
          </div>

          {/* Company multi-select */}
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-neutral-700">
              Companies <span className="text-danger-500">*</span>
            </span>
            {errors.company_ids && (
              <p className="text-xs text-danger-500">{errors.company_ids.message}</p>
            )}
            <Controller
              name="company_ids"
              control={control}
              render={({ field }) => (
                <div className="max-h-36 divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
                  {companies.map((c) => {
                    const checked = field.value.includes(c.id)
                    return (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-neutral-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            field.onChange(
                              checked
                                ? field.value.filter((id) => id !== c.id)
                                : [...field.value, c.id],
                            )
                          }
                          className="h-4 w-4 rounded border-neutral-300 text-primary-600 accent-primary-600"
                        />
                        <span className="w-14 font-mono text-[11px] text-neutral-400">
                          {c.code}
                        </span>
                        <span className="text-sm">{c.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            />
          </div>

          <DialogFooter>
            <Button variant="secondary" type="button" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Create employee
            </Button>
          </DialogFooter>
        </form>
      )}

      {success && (
        <DialogFooter>
          <Button onClick={handleClose}>Done</Button>
        </DialogFooter>
      )}
    </Dialog>
  )
}
