'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import type { UserRole } from '@/lib/types'

const ACTION_OPTIONS = [
  { value: '',        label: 'All actions' },
  { value: 'created', label: 'Work order created' },
  { value: 'updated', label: 'Work order updated' },
  { value: 'status',  label: 'Status changed' },
  { value: 'hours',   label: 'Hours logged' },
  { value: 'system',  label: 'System events' },
]

interface Employee {
  id:            string
  full_name:     string
  employee_code: string
}

interface Props {
  role:               UserRole
  employees:          Employee[]
  defaultFrom:        string
  defaultTo:          string
  defaultEmployeeId:  string
  defaultActionType:  string
}

export function ActivityLogFilters({
  role, employees, defaultFrom, defaultTo, defaultEmployeeId, defaultActionType,
}: Props) {
  const router      = useRouter()
  const searchParams = useSearchParams()

  const from       = searchParams.get('from')       ?? defaultFrom
  const to         = searchParams.get('to')         ?? defaultTo
  const employeeId = searchParams.get('employeeId') ?? defaultEmployeeId
  const actionType = searchParams.get('actionType') ?? defaultActionType

  const update = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/activity-log?${params.toString()}`)
  }

  const canFilterByEmployee = ['admin', 'manager', 'director'].includes(role)
  const inputCls = 'h-9 rounded border border-neutral-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'
  const labelCls = 'text-xs font-medium text-neutral-500'

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className={labelCls}>From</label>
        <input
          type="date"
          value={from}
          onChange={(e) => update('from', e.target.value)}
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className={labelCls}>To</label>
        <input
          type="date"
          value={to}
          onChange={(e) => update('to', e.target.value)}
          className={inputCls}
        />
      </div>

      {canFilterByEmployee && employees.length > 0 && (
        <div className="flex flex-col gap-1">
          <label className={labelCls}>Employee</label>
          <select
            value={employeeId}
            onChange={(e) => update('employeeId', e.target.value)}
            className={inputCls}
          >
            <option value="">All employees</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name} ({e.employee_code})
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className={labelCls}>Action type</label>
        <select
          value={actionType}
          onChange={(e) => update('actionType', e.target.value)}
          className={inputCls}
        >
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
