'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, UserX, UserCheck, AlertTriangle, LogOut } from 'lucide-react'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { updateEmployeeProfile, setEmployeeStatus } from '@/lib/actions/employees'
import { updateEmployeeOrg } from '@/lib/actions/org'
import { useToast } from '@/lib/store/toast'
import { ForceClockOutDialog } from '@/components/time/ForceClockOutDialog'
import type { Profile, Team, Company, UserRole } from '@/lib/types'

export interface EmployeeDetailData extends Profile {
  team:              { id: string; name: string; code: string } | null
  manager:           { id: string; full_name: string; employee_code: string } | null
  currentCompanyIds: string[]
}

interface Props {
  employee:    EmployeeDetailData
  teams:       (Pick<Team, 'id' | 'name' | 'code'> & { manager_id: string | null })[]
  companies:   Pick<Company, 'id' | 'name' | 'code'>[]
  managers:    Pick<Profile, 'id' | 'full_name' | 'employee_code'>[]
  isAdmin:     boolean
  openSession: { id: string; clock_in_at: string } | null
}

const profileSchema = z.object({
  full_name:  z.string().min(1, 'Full name is required'),
  phone:      z.string().optional().nullable(),
  department: z.string().optional().nullable(),
  role:       z.enum(['admin', 'director', 'manager', 'employee']),
})
type ProfileForm = z.infer<typeof profileSchema>

const ROLE_VARIANT: Record<UserRole, 'danger' | 'purple' | 'info' | 'default'> = {
  admin:    'danger',
  director: 'purple',
  manager:  'info',
  employee: 'default',
}

export function EmployeeDetail({ employee, teams, companies, managers, isAdmin, openSession }: Props) {
  const router = useRouter()
  const toast  = useToast()

  const [emp, setEmp] = useState<EmployeeDetailData>(employee)
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [statusBusy,     setStatusBusy]     = useState(false)
  const [forceOpen,      setForceOpen]      = useState(false)

  // Org form local state
  const [teamId,      setTeamId]      = useState(emp.team_id      ?? '')
  const [managerId,   setManagerId]   = useState(emp.manager_id   ?? '')
  const [companyIds,  setCompanyIds]  = useState(emp.currentCompanyIds)
  const [orgBusy,     setOrgBusy]     = useState(false)
  const [orgError,    setOrgError]    = useState<string | null>(null)

  // Auto-fill manager from team selection
  useEffect(() => {
    if (!teamId) return
    const team = teams.find((t) => t.id === teamId)
    if (team?.manager_id) setManagerId(team.manager_id)
  }, [teamId, teams])

  // Profile form
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name:  emp.full_name,
      phone:      emp.phone      ?? '',
      department: emp.department ?? '',
      role:       emp.role,
    },
  })

  const onProfileSave = async (values: ProfileForm) => {
    const res = await updateEmployeeProfile(emp.id, values)
    if (res.error) { setError('root', { message: res.error }); return }
    setEmp((prev) => ({ ...prev, ...res.data! }))
    toast.success('Profile saved')
    router.refresh()
  }

  const onOrgSave = async () => {
    setOrgBusy(true)
    setOrgError(null)
    const res = await updateEmployeeOrg({
      employee_id: emp.id,
      team_id:     teamId    || null,
      manager_id:  managerId || null,
      company_ids: companyIds,
    })
    setOrgBusy(false)
    if (res.error) { setOrgError(res.error); return }
    setEmp((prev) => ({
      ...prev,
      team_id:           teamId    || null,
      manager_id:        managerId || null,
      currentCompanyIds: companyIds,
    }))
    toast.success('Org assignment saved')
    router.refresh()
  }

  const onStatusChange = async () => {
    const next = emp.status === 'active' ? 'inactive' : 'active'
    setStatusBusy(true)
    const res = await setEmployeeStatus(emp.id, next as 'active' | 'inactive')
    setStatusBusy(false)
    if (res.error) { toast.error(res.error); return }
    setEmp((prev) => ({ ...prev, status: next }))
    setDeactivateOpen(false)
    toast.success(next === 'inactive' ? 'Employee deactivated' : 'Employee reactivated')
    router.refresh()
  }

  const isActive = emp.status === 'active'

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/employees"
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Employees
          </Link>
          <span className="text-neutral-300">/</span>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">{emp.full_name}</h2>
            <div className="mt-0.5 flex items-center gap-2">
              <span className="font-mono text-xs text-neutral-400">{emp.employee_code}</span>
              <Badge variant={ROLE_VARIANT[emp.role]} className="capitalize">
                {emp.role}
              </Badge>
              <Badge variant={isActive ? 'success' : 'warning'}>
                {isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {openSession && (
              <Button variant="secondary" size="sm" onClick={() => setForceOpen(true)}>
                <LogOut className="h-3.5 w-3.5" />
                Force clock out
              </Button>
            )}
            <Button
              variant={isActive ? 'destructive' : 'secondary'}
              size="sm"
              onClick={() => setDeactivateOpen(true)}
            >
              {isActive
                ? <><UserX  className="h-3.5 w-3.5" /> Deactivate</>
                : <><UserCheck className="h-3.5 w-3.5" /> Reactivate</>}
            </Button>
          </div>
        )}
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Profile section */}
        <div className="card p-5">
          <h3 className="mb-4 text-sm font-semibold text-neutral-800">Profile information</h3>

          <form onSubmit={handleSubmit(onProfileSave)} noValidate className="flex flex-col gap-4">
            {errors.root && (
              <div className="rounded-md border border-danger-500/30 bg-danger-50 px-3 py-2 text-sm text-danger-700">
                {errors.root.message}
              </div>
            )}

            <Input
              label="Full name"
              error={errors.full_name?.message}
              {...register('full_name')}
            />

            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-neutral-700">Email</span>
              <p className="text-sm text-neutral-600">{emp.email}</p>
              <p className="text-xs text-neutral-400">
                Email changes require a Supabase auth admin action.
              </p>
            </div>

            <Input
              label="Phone"
              type="tel"
              error={errors.phone?.message}
              {...register('phone')}
            />

            <Input
              label="Department"
              error={errors.department?.message}
              {...register('department')}
            />

            <Select
              label="Role"
              disabled={!isAdmin}
              error={errors.role?.message}
              {...register('role')}
            >
              <option value="admin">Admin</option>
              <option value="director">Director</option>
              <option value="manager">Manager</option>
              <option value="employee">Employee</option>
            </Select>

            {!isAdmin && (
              <p className="text-xs text-neutral-400">Role changes require Admin access.</p>
            )}

            <div className="flex justify-end pt-1">
              <Button type="submit" size="sm" loading={isSubmitting}>
                Save profile
              </Button>
            </div>
          </form>
        </div>

        {/* Org assignment section — admin only */}
        {isAdmin && (
          <div className="card p-5">
            <h3 className="mb-4 text-sm font-semibold text-neutral-800">Org assignment</h3>

            <div className="flex flex-col gap-4">
              {orgError && (
                <div className="rounded-md border border-danger-500/30 bg-danger-50 px-3 py-2 text-sm text-danger-700">
                  {orgError}
                </div>
              )}

              {/* Team */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-neutral-700">Team</label>
                <div className="relative">
                  <select
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                    className="h-9 w-full appearance-none rounded border border-neutral-300 bg-white pl-3 pr-8 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">— no team —</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.code} — {t.name}
                        {!t.manager_id ? ' ⚠ no manager' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Direct manager */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-neutral-700">Direct manager</label>
                <div className="relative">
                  <select
                    value={managerId}
                    onChange={(e) => setManagerId(e.target.value)}
                    className="h-9 w-full appearance-none rounded border border-neutral-300 bg-white pl-3 pr-8 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">— no manager —</option>
                    {managers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name} ({m.employee_code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Company checkboxes */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-neutral-700">Linked companies</span>
                <div className="max-h-44 divide-y divide-neutral-100 overflow-y-auto rounded-md border border-neutral-200">
                  {companies.map((c) => {
                    const checked = companyIds.includes(c.id)
                    return (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-neutral-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setCompanyIds((prev) =>
                              checked
                                ? prev.filter((id) => id !== c.id)
                                : [...prev, c.id],
                            )
                          }
                          className="h-4 w-4 rounded border-neutral-300 accent-primary-600"
                        />
                        <span className="w-14 font-mono text-[11px] text-neutral-400">
                          {c.code}
                        </span>
                        <span className="text-sm">{c.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button size="sm" loading={orgBusy} onClick={onOrgSave}>
                  Save assignment
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Force clock out dialog */}
      {isAdmin && openSession && (
        <ForceClockOutDialog
          open={forceOpen}
          employeeId={emp.id}
          timeLogId={openSession.id}
          clockInAt={openSession.clock_in_at}
          onClose={() => setForceOpen(false)}
        />
      )}

      {/* Deactivate / Reactivate confirmation dialog */}
      <Dialog
        open={deactivateOpen}
        onClose={() => setDeactivateOpen(false)}
        title={isActive ? 'Deactivate employee?' : 'Reactivate employee?'}
        size="sm"
      >
        {isActive ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2 rounded-md border border-warning-500/30 bg-warning-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-500" />
              <p className="text-sm text-warning-700">
                <strong>{emp.full_name}</strong> will immediately lose access to WSSO.
                Their tactics, time logs, and documents remain intact for Admin and Manager
                review.
              </p>
            </div>
            <p className="text-sm text-neutral-600">
              They will not be able to log in until reactivated.
            </p>
          </div>
        ) : (
          <p className="text-sm text-neutral-600">
            <strong>{emp.full_name}</strong> will regain full access to WSSO and can log in
            again with their existing credentials.
          </p>
        )}

        <DialogFooter>
          <Button variant="secondary" onClick={() => setDeactivateOpen(false)}>
            Cancel
          </Button>
          <Button
            variant={isActive ? 'destructive' : 'primary'}
            loading={statusBusy}
            onClick={onStatusChange}
          >
            {isActive ? 'Yes, deactivate' : 'Yes, reactivate'}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
