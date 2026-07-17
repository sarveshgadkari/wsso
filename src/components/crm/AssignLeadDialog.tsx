'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { getAssignableUsers, assignLead, unassignLead } from '@/lib/actions/leads'
import type { LeadRow } from './LeadsTable'

type AssignableUser = { id: string; full_name: string; employee_code: string; role: string }

interface Props {
  lead: LeadRow
  open: boolean
  onClose: () => void
}

export function AssignLeadDialog({ lead, open, onClose }: Props) {
  const router = useRouter()
  const [users, setUsers]     = useState<AssignableUser[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded]   = useState(false)
  const [selected, setSelected] = useState('')
  const [error, setError]     = useState('')
  const [isPending, start]    = useTransition()

  function loadUsers() {
    setLoading(true)
    setError('')
    getAssignableUsers(lead.id)
      .then(u => { setUsers(u); setLoaded(true) })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (open) { setSelected(''); setError(''); loadUsers() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead.id])

  function handleAssign() {
    if (!selected) { setError('Select someone to assign'); return }
    setError('')
    start(async () => {
      try {
        await assignLead(lead.id, selected)
        setSelected('')
        loadUsers()
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to assign')
      }
    })
  }

  function handleUnassign(assignmentId: string) {
    start(async () => {
      try {
        await unassignLead(assignmentId)
        loadUsers()
        router.refresh()
      } catch {
        router.refresh()
      }
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Assign — ${lead.first_name} ${lead.last_name}`}
      description={lead.company ?? lead.website_name}
      size="sm"
    >
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Currently assigned
          </h3>
          {lead.assignments.length === 0 ? (
            <p className="text-sm text-neutral-400">Not assigned to anyone yet.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-100">
              {lead.assignments.map(a => (
                <li key={a.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-800">{a.employee.full_name}</p>
                    <p className="text-xs text-neutral-400">
                      {a.employee.employee_code} · {a.employee.role}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUnassign(a.id)}
                    disabled={isPending}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-danger-600"
                    title="Remove assignment"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Assign to someone else
          </h3>
          {loading ? (
            <p className="text-sm text-neutral-400">Loading people…</p>
          ) : loaded && users.length === 0 ? (
            <p className="text-sm text-neutral-400">Everyone active is already assigned.</p>
          ) : (
            <select
              value={selected}
              onChange={e => setSelected(e.target.value)}
              className="h-10 w-full rounded border border-neutral-300 bg-white px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Select a person…</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.full_name} ({u.employee_code}) — {u.role}
                </option>
              ))}
            </select>
          )}
        </div>

        {error && <p className="text-sm text-danger-600">{error}</p>}

        <DialogFooter>
          <Button variant="secondary" type="button" onClick={onClose} disabled={isPending}>
            Close
          </Button>
          <Button type="button" onClick={handleAssign} loading={isPending} disabled={!selected}>
            Assign
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  )
}
