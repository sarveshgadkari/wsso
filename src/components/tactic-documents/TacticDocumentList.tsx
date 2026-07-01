'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'

export type TacticDocStatus = 'draft' | 'submitted' | 'reviewed' | 'approved' | 'revision_needed'

export interface TacticDocRow {
  id:             string
  code:           string
  date_of_meeting: string | null
  purpose:        string
  facilitator:    string | null
  status:         TacticDocStatus
  created_at:     string
  creator: { id: string; full_name: string; role: string } | null
  company: { name: string } | null
  project: { name: string; code: string } | null
}

const STATUS_LABEL: Record<TacticDocStatus, string> = {
  draft:            'Draft',
  submitted:        'Submitted',
  reviewed:         'Reviewed',
  approved:         'Approved',
  revision_needed:  'Revision Needed',
}

const STATUS_VARIANT: Record<TacticDocStatus, 'default' | 'info' | 'purple' | 'success' | 'danger'> = {
  draft:           'default',
  submitted:       'info',
  reviewed:        'purple',
  approved:        'success',
  revision_needed: 'danger',
}

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '',                label: 'All statuses' },
  { value: 'draft',           label: 'Draft' },
  { value: 'submitted',       label: 'Submitted' },
  { value: 'reviewed',        label: 'Reviewed' },
  { value: 'approved',        label: 'Approved' },
  { value: 'revision_needed', label: 'Revision Needed' },
]

type Employee = { id: string; full_name: string; employee_code: string }

interface Props {
  docs:      TacticDocRow[]
  canFilter: boolean
  employees: Employee[]
}

const selectCls =
  'h-9 rounded border border-neutral-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500'

export function TacticDocumentList({ docs, canFilter, employees }: Props) {
  const router = useRouter()
  const [statusFilter, setStatusFilter]     = useState('')
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [fromFilter, setFromFilter]         = useState('')
  const [toFilter,   setToFilter]           = useState('')

  const filtered = useMemo(() => {
    return docs.filter(d => {
      if (statusFilter   && d.status !== statusFilter) return false
      if (employeeFilter && d.creator?.id !== employeeFilter) return false
      if (fromFilter && d.date_of_meeting && d.date_of_meeting < fromFilter) return false
      if (toFilter   && d.date_of_meeting && d.date_of_meeting > toFilter)   return false
      return true
    })
  }, [docs, statusFilter, employeeFilter, fromFilter, toFilter])

  function fmtDate(iso: string | null): string {
    if (!iso) return '—'
    return new Date(iso + 'T00:00:00').toLocaleDateString([], {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500">Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={selectCls}>
            {STATUS_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500">Meeting From</label>
          <input
            type="date"
            value={fromFilter}
            onChange={e => setFromFilter(e.target.value)}
            className={selectCls}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-500">Meeting To</label>
          <input
            type="date"
            value={toFilter}
            onChange={e => setToFilter(e.target.value)}
            className={selectCls}
          />
        </div>

        {canFilter && employees.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-neutral-500">Created by</label>
            <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} className={selectCls}>
              <option value="">All employees</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-neutral-100 text-sm">
            <thead className="bg-neutral-50">
              <tr>
                {['Code', 'Meeting Date', 'Purpose', 'Facilitator', 'Created by', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-neutral-400">
                    {docs.length === 0
                      ? 'No TACTIC documents yet.'
                      : 'No documents match the current filters.'}
                  </td>
                </tr>
              ) : (
                filtered.map(d => (
                  <tr
                    key={d.id}
                    onClick={() => router.push(`/tactic-documents/${d.id}`)}
                    className="cursor-pointer transition-colors hover:bg-neutral-50"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-medium text-primary-700">
                        {d.code}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-neutral-700">
                      {fmtDate(d.date_of_meeting)}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p className="truncate text-neutral-800">{d.purpose}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-neutral-600">
                      {d.facilitator ?? '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.creator ? (
                        <div>
                          <p className="font-medium text-neutral-800">{d.creator.full_name}</p>
                          <p className="text-xs capitalize text-neutral-400">{d.creator.role}</p>
                        </div>
                      ) : <span className="text-neutral-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[d.status] as never}>
                        {STATUS_LABEL[d.status]}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-neutral-400">
        {filtered.length} of {docs.length} {docs.length === 1 ? 'document' : 'documents'}
      </p>
    </div>
  )
}
