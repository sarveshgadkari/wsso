'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { saveRecurringJob } from '@/lib/actions/ops'
import type { EmployeeOrgRow } from '@/components/hierarchy/OrgAssignmentDialog'
import type { ChecklistTemplate, OrgCatalogItem, RecurringJob } from '@/lib/workspace/rows'
import { useToast } from '@/lib/store/toast'

export function RecurringJobsPanel({
  jobs,
  employees,
  projects,
  checklists,
  jobTypes,
}: {
  jobs: RecurringJob[]
  employees: EmployeeOrgRow[]
  projects: { id: string; name: string; code: string }[]
  checklists: ChecklistTemplate[]
  jobTypes: OrgCatalogItem[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [pending, start] = useTransition()
  const [title, setTitle] = useState('')
  const [assignedTo, setAssignedTo] = useState('')
  const [projectId, setProjectId] = useState('')
  const [checklistId, setChecklistId] = useState('')
  const [typeId, setTypeId] = useState('')
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [nextRun, setNextRun] = useState('')

  function add() {
    start(async () => {
      const res = await saveRecurringJob({
        title,
        description: null,
        project_id: projectId || null,
        assigned_to: assignedTo || null,
        checklist_template_id: checklistId || null,
        work_order_type_id: typeId || null,
        priority: 'medium',
        estimated_hours: null,
        frequency,
        interval_n: 1,
        next_run_on: nextRun,
        is_active: true,
      })
      if (res.error) toast.error(res.error)
      else {
        setTitle('')
        toast.success('Recurring job saved — the daily job will create the next work order')
        router.refresh()
      }
    })
  }

  function toggle(job: RecurringJob) {
    start(async () => {
      await saveRecurringJob({ ...job, is_active: !job.is_active })
      router.refresh()
    })
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-sm text-neutral-500">
        Weekly inspections, monthly reports — WSSO creates the work order on the next run date (same daily cron as auto clock-out).
      </p>
      <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Assign to</label>
          <select className="h-9 rounded border border-neutral-300 px-3 text-sm" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
            <option value="">Select…</option>
            {employees.filter((e) => e.status === 'active').map((e) => (
              <option key={e.id} value={e.id}>{e.full_name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Project</label>
          <select className="h-9 rounded border border-neutral-300 px-3 text-sm" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">None</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Checklist</label>
          <select className="h-9 rounded border border-neutral-300 px-3 text-sm" value={checklistId} onChange={(e) => setChecklistId(e.target.value)}>
            <option value="">None</option>
            {checklists.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Job type</label>
          <select className="h-9 rounded border border-neutral-300 px-3 text-sm" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">Standard</option>
            {jobTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Repeat</label>
          <select className="h-9 rounded border border-neutral-300 px-3 text-sm" value={frequency} onChange={(e) => setFrequency(e.target.value as typeof frequency)}>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
        </div>
        <Input label="Next run" type="date" value={nextRun} onChange={(e) => setNextRun(e.target.value)} />
      </div>
      <Button onClick={add} loading={pending} disabled={!title.trim() || !assignedTo || !nextRun}>Save recurring job</Button>

      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {jobs.length === 0 && <li className="px-4 py-6 text-center text-sm text-neutral-400">No recurring jobs.</li>}
        {jobs.map((j) => (
          <li key={j.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className={`text-sm font-medium ${j.is_active ? 'text-neutral-800' : 'text-neutral-400'}`}>{j.title}</p>
              <p className="text-xs text-neutral-400">
                {j.frequency} · next {j.next_run_on}{j.last_run_on ? ` · last ${j.last_run_on}` : ''}
              </p>
            </div>
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => toggle(j)}>
              {j.is_active ? 'Pause' : 'Resume'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
