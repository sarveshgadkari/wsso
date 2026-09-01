'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Badge } from '@/components/ui/Badge'
import { deleteComplianceRecord, saveComplianceRecord } from '@/lib/actions/ops'
import type { ComplianceRecord, OrgCatalogItem } from '@/lib/workspace/rows'
import { useToast } from '@/lib/store/toast'

export function ComplianceTable({
  records,
  types,
  people,
  clients,
  today,
  soon,
}: {
  records: ComplianceRecord[]
  types: OrgCatalogItem[]
  people: { id: string; full_name: string; employee_code: string }[]
  clients: { id: string; name: string; code: string }[]
  today: string
  soon: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [typeId, setTypeId] = useState('')
  const [profileId, setProfileId] = useState('')
  const [clientId, setClientId] = useState('')
  const [expires, setExpires] = useState('')
  const [notes, setNotes] = useState('')
  const [pending, start] = useTransition()

  const typeLabel = Object.fromEntries(types.map((t) => [t.id, t.label]))
  const personName = Object.fromEntries(people.map((p) => [p.id, p.full_name]))
  const clientName = Object.fromEntries(clients.map((c) => [c.id, c.name]))

  function reset() {
    setTitle('')
    setTypeId('')
    setProfileId('')
    setClientId('')
    setExpires('')
    setNotes('')
  }

  function save() {
    start(async () => {
      const res = await saveComplianceRecord({
        title,
        type_id: typeId || null,
        profile_id: profileId || null,
        client_id: clientId || null,
        expires_on: expires || null,
        notes,
      })
      if (res.error) toast.error(res.error)
      else {
        reset()
        setOpen(false)
        toast.success('Saved')
        router.refresh()
      }
    })
  }

  function variant(expiresOn: string | null): 'danger' | 'warning' | 'success' | 'default' {
    if (!expiresOn) return 'default'
    if (expiresOn < today) return 'danger'
    if (expiresOn <= soon) return 'warning'
    return 'success'
  }

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>Add record</Button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2">Title</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Person / client</th>
              <th className="px-4 py-2">Expires</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {records.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-neutral-400">No records yet.</td></tr>
            )}
            {records.map((r) => (
              <tr key={r.id}>
                <td className="px-4 py-2 font-medium text-neutral-800">{r.title}</td>
                <td className="px-4 py-2 text-neutral-600">{r.type_id ? typeLabel[r.type_id] ?? '—' : '—'}</td>
                <td className="px-4 py-2 text-neutral-600">
                  {r.profile_id ? personName[r.profile_id] : r.client_id ? clientName[r.client_id] : '—'}
                </td>
                <td className="px-4 py-2">
                  {r.expires_on ? <Badge variant={variant(r.expires_on)}>{r.expires_on}</Badge> : '—'}
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger-600"
                    disabled={pending}
                    onClick={() => start(async () => {
                      await deleteComplianceRecord(r.id)
                      router.refresh()
                    })}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onClose={() => { reset(); setOpen(false) }} title="Add license / contract" size="md">
        <div className="flex flex-col gap-3">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-neutral-700">Type</label>
            <select className="h-9 rounded border border-neutral-300 px-3 text-sm" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              <option value="">—</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-neutral-700">Person</label>
              <select className="h-9 rounded border border-neutral-300 px-3 text-sm" value={profileId} onChange={(e) => setProfileId(e.target.value)}>
                <option value="">—</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-neutral-700">Client</label>
              <select className="h-9 rounded border border-neutral-300 px-3 text-sm" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">—</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <Input label="Expires on" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => { reset(); setOpen(false) }}>Cancel</Button>
          <Button onClick={save} loading={pending} disabled={!title.trim()}>Save</Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
