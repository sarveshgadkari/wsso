'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { convertLeadToClient, saveLeadFollowUp, setLeadOutcome } from '@/lib/actions/ops'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/lib/store/toast'
import type { OrgCatalogItem } from '@/lib/workspace/rows'
import type { LeadRow } from '@/components/crm/LeadsTable'

export function LeadOpsButtons({
  lead,
  companies,
  winReasons,
  lostReasons,
  defaultFollowUpDays,
}: {
  lead: LeadRow
  companies: { id: string; name: string }[]
  winReasons: OrgCatalogItem[]
  lostReasons: OrgCatalogItem[]
  defaultFollowUpDays: number
}) {
  const router = useRouter()
  const toast = useToast()
  const [mode, setMode] = useState<'convert' | 'lost' | 'follow' | null>(null)
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? '')
  const [createProject, setCreateProject] = useState(true)
  const [reason, setReason] = useState('')
  const [due, setDue] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + defaultFollowUpDays)
    return d.toISOString().split('T')[0]
  })
  const [note, setNote] = useState('')
  const [pending, start] = useTransition()

  const converted = lead.status === 'converted'

  function runConvert() {
    start(async () => {
      const res = await convertLeadToClient({
        leadId: lead.id,
        company_id: companyId,
        outcome_reason: reason || null,
        createProject,
      })
      if (res.error) toast.error(res.error)
      else {
        toast.success(`Client ${res.data?.clientCode ?? ''} created`)
        setMode(null)
        router.refresh()
      }
    })
  }

  function runLost() {
    start(async () => {
      const res = await setLeadOutcome(lead.id, 'lost', reason || null)
      if (res.error) toast.error(res.error)
      else {
        toast.success('Marked lost')
        setMode(null)
        router.refresh()
      }
    })
  }

  function runFollow() {
    start(async () => {
      const res = await saveLeadFollowUp({ leadId: lead.id, due_on: due, note })
      if (res.error) toast.error(res.error)
      else {
        toast.success('Follow-up saved')
        setMode(null)
        router.refresh()
      }
    })
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1">
        {!converted && lead.status !== 'lost' && (
          <Button variant="ghost" size="sm" onClick={() => setMode('convert')}>Convert</Button>
        )}
        {lead.status !== 'lost' && lead.status !== 'converted' && (
          <Button variant="ghost" size="sm" onClick={() => setMode('lost')}>Lost</Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setMode('follow')}>Follow-up</Button>
      </div>

      <Dialog open={mode === 'convert'} onClose={() => setMode(null)} title="Convert to client" size="sm">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600">Creates a client from this lead. Optionally opens a kickoff project.</p>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700">Company</label>
            <select className="h-9 rounded border border-neutral-300 px-3 text-sm" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
              {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700">Why we won</label>
            <select className="h-9 rounded border border-neutral-300 px-3 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">—</option>
              {winReasons.map((r) => <option key={r.id} value={r.label}>{r.label}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={createProject} onChange={(e) => setCreateProject(e.target.checked)} />
            Create kickoff project
          </label>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setMode(null)}>Cancel</Button>
          <Button onClick={runConvert} loading={pending} disabled={!companyId}>Convert</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={mode === 'lost'} onClose={() => setMode(null)} title="Mark lost" size="sm">
        <div className="flex flex-col gap-3">
          <select className="h-9 rounded border border-neutral-300 px-3 text-sm" value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="">Reason</option>
            {lostReasons.map((r) => <option key={r.id} value={r.label}>{r.label}</option>)}
          </select>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setMode(null)}>Cancel</Button>
          <Button variant="destructive" onClick={runLost} loading={pending}>Mark lost</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={mode === 'follow'} onClose={() => setMode(null)} title="Next follow-up" size="sm">
        <div className="flex flex-col gap-3">
          <Input label="Due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setMode(null)}>Cancel</Button>
          <Button onClick={runFollow} loading={pending} disabled={!due}>Save</Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
