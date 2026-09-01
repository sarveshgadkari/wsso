'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { updateEmployeeOps } from '@/lib/actions/workspace'
import type { Profile } from '@/lib/types'
import type { EmployeeOrgRow } from '@/components/hierarchy/OrgAssignmentDialog'
import type { OrgCatalogItem, OrgLocation } from '@/lib/workspace/rows'
import { useToast } from '@/lib/store/toast'

export function RatesSkillsPanel({
  employees,
  locations,
  managers,
  skills,
  skillsByEmployee,
}: {
  employees: EmployeeOrgRow[]
  locations: OrgLocation[]
  managers: Pick<Profile, 'id' | 'full_name' | 'employee_code'>[]
  skills: OrgCatalogItem[]
  skillsByEmployee: Record<string, string[]>
}) {
  const router = useRouter()
  const toast = useToast()
  const [pending, start] = useTransition()
  const [draft, setDraft] = useState<Record<string, {
    hourly: string
    location_id: string
    backup_approver_id: string
    skill_ids: string[]
  }>>(() => {
    const init: Record<string, { hourly: string; location_id: string; backup_approver_id: string; skill_ids: string[] }> = {}
    for (const e of employees) {
      init[e.id] = {
        hourly: ((e.hourly_rate_cents ?? 0) / 100).toFixed(2),
        location_id: e.location_id ?? '',
        backup_approver_id: e.backup_approver_id ?? '',
        skill_ids: skillsByEmployee[e.id] ?? [],
      }
    }
    return init
  })

  function save(id: string) {
    const d = draft[id]
    start(async () => {
      const res = await updateEmployeeOps({
        employee_id: id,
        hourly_rate_cents: Math.round(Number(d.hourly || 0) * 100),
        location_id: d.location_id || null,
        backup_approver_id: d.backup_approver_id || null,
        skill_ids: d.skill_ids,
      })
      if (res.error) toast.error(res.error)
      else {
        toast.success('Saved')
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-neutral-500">
        Hourly rate is used for job costing and payroll export. Backup approver covers leave when the manager is off.
      </p>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Person</th>
              <th className="px-3 py-2">$/hr</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Backup approver</th>
              <th className="px-3 py-2">Skills</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {employees.filter((e) => e.role !== 'super_admin').map((e) => {
              const d = draft[e.id]
              if (!d) return null
              return (
                <tr key={e.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-neutral-800">{e.full_name}</p>
                    <p className="font-mono text-[11px] text-neutral-400">{e.employee_code}</p>
                  </td>
                  <td className="px-3 py-2 w-28">
                    <Input
                      value={d.hourly}
                      onChange={(ev) => setDraft({ ...draft, [e.id]: { ...d, hourly: ev.target.value } })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="h-9 w-full min-w-[8rem] rounded border border-neutral-300 px-2 text-sm"
                      value={d.location_id}
                      onChange={(ev) => setDraft({ ...draft, [e.id]: { ...d, location_id: ev.target.value } })}
                    >
                      <option value="">—</option>
                      {locations.filter((l) => l.is_active).map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="h-9 w-full min-w-[8rem] rounded border border-neutral-300 px-2 text-sm"
                      value={d.backup_approver_id}
                      onChange={(ev) => setDraft({ ...draft, [e.id]: { ...d, backup_approver_id: ev.target.value } })}
                    >
                      <option value="">—</option>
                      {managers.filter((m) => m.id !== e.id).map((m) => (
                        <option key={m.id} value={m.id}>{m.full_name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      multiple
                      className="min-h-[2.25rem] min-w-[9rem] rounded border border-neutral-300 px-2 text-xs"
                      value={d.skill_ids}
                      onChange={(ev) => {
                        const skill_ids = Array.from(ev.target.selectedOptions).map((o) => o.value)
                        setDraft({ ...draft, [e.id]: { ...d, skill_ids } })
                      }}
                    >
                      {skills.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Button size="sm" onClick={() => save(e.id)} loading={pending}>Save</Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
