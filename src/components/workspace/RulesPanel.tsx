'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { saveWorkspaceSettings } from '@/lib/actions/workspace'
import type { WorkspaceSettings } from '@/lib/workspace/settings'
import { useToast } from '@/lib/store/toast'

export function RulesPanel({ settings }: { settings: WorkspaceSettings }) {
  const router = useRouter()
  const toast = useToast()
  const [time, setTime] = useState(settings.time)
  const [workOrders, setWorkOrders] = useState(settings.workOrders)
  const [crm, setCrm] = useState(settings.crm)
  const [leave, setLeave] = useState(settings.leave)
  const [pending, start] = useTransition()

  function save() {
    start(async () => {
      const res = await saveWorkspaceSettings({ time, workOrders, crm, leave })
      if (res.error) toast.error(res.error)
      else {
        toast.success('Work rules saved')
        router.refresh()
      }
    })
  }

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <section className="card flex flex-col gap-3 p-5">
        <h3 className="text-sm font-semibold text-neutral-800">Time</h3>
        <Input
          label="Overtime after (hours / week)"
          type="number"
          min={1}
          value={Math.round(time.overtimeWeeklyMinutes / 60)}
          onChange={(e) => setTime({ ...time, overtimeWeeklyMinutes: Number(e.target.value) * 60 })}
        />
        <Input
          label="Target hours per day"
          type="number"
          min={1}
          value={Math.round(time.targetDailyMinutes / 60)}
          onChange={(e) => setTime({ ...time, targetDailyMinutes: Number(e.target.value) * 60 })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={time.requireClockInNote}
            onChange={(e) => setTime({ ...time, requireClockInNote: e.target.checked })}
          />
          Require a note when clocking in
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={time.requireClockOutNote}
            onChange={(e) => setTime({ ...time, requireClockOutNote: e.target.checked })}
          />
          Require a note when clocking out
        </label>
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <h3 className="text-sm font-semibold text-neutral-800">Leave</h3>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={leave.requireType}
            onChange={(e) => setLeave({ ...leave, requireType: e.target.checked })}
          />
          Require a leave type (vacation, sick, …)
        </label>
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <h3 className="text-sm font-semibold text-neutral-800">Work orders</h3>
        <Input
          label="Default SLA hours (optional)"
          type="number"
          min={0}
          value={workOrders.defaultSlaHours ?? ''}
          onChange={(e) =>
            setWorkOrders({
              ...workOrders,
              defaultSlaHours: e.target.value === '' ? null : Number(e.target.value),
            })
          }
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={workOrders.requireChecklistOnCreate}
            onChange={(e) => setWorkOrders({ ...workOrders, requireChecklistOnCreate: e.target.checked })}
          />
          Require a checklist when creating a job
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={workOrders.defaultBillable}
            onChange={(e) => setWorkOrders({ ...workOrders, defaultBillable: e.target.checked })}
          />
          New jobs are billable by default
        </label>
      </section>

      <section className="card flex flex-col gap-3 p-5">
        <h3 className="text-sm font-semibold text-neutral-800">CRM</h3>
        <Input
          label="Default follow-up in (days)"
          type="number"
          min={1}
          value={crm.defaultFollowUpDays}
          onChange={(e) => setCrm({ ...crm, defaultFollowUpDays: Number(e.target.value) })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={crm.requireFollowUpOnStatusChange}
            onChange={(e) => setCrm({ ...crm, requireFollowUpOnStatusChange: e.target.checked })}
          />
          Prompt for a next follow-up when a lead status changes
        </label>
      </section>

      <div>
        <Button onClick={save} loading={pending}>Save rules</Button>
      </div>
    </div>
  )
}
