'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { UserPlus, X } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import {
  getShareableUsers,
  getTacticDocumentShares,
  shareTacticDocument,
  unshareTacticDocument,
} from '@/lib/actions/tactic-documents'
import type { TacticDocShareRow } from '@/lib/tactic-documents/shares'

interface Props {
  docId:    string
  docCode:  string
  isOwner:  boolean
}

type ShareableUser = { id: string; full_name: string; employee_code: string; role: string }

export function TacticSharePanel({ docId, docCode, isOwner }: Props) {
  const router = useRouter()
  const [shares, setShares]       = useState<TacticDocShareRow[]>([])
  const [sharesLoaded, setSharesLoaded] = useState(false)
  const [open, setOpen]           = useState(false)
  const [users, setUsers]         = useState<ShareableUser[]>([])
  const [selected, setSelected]   = useState('')
  const [error, setError]         = useState('')
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [isPending, start]        = useTransition()

  useEffect(() => {
    if (!isOwner) return
    getTacticDocumentShares(docId)
      .then(data => setShares(data))
      .catch(() => setShares([]))
      .finally(() => setSharesLoaded(true))
  }, [docId, isOwner])

  function handleOpen() {
    setError('')
    setSelected('')
    setOpen(true)
    setLoadingUsers(true)
    getShareableUsers(docId)
      .then(setUsers)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load users'))
      .finally(() => setLoadingUsers(false))
  }

  function handleShare() {
    if (!selected) {
      setError('Select someone to share with')
      return
    }
    setError('')
    start(async () => {
      try {
        await shareTacticDocument(docId, selected)
        setOpen(false)
        setSelected('')
        const updated = await getTacticDocumentShares(docId)
        setShares(updated)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to share')
      }
    })
  }

  function handleUnshare(shareId: string) {
    start(async () => {
      try {
        await unshareTacticDocument(docId, shareId)
        setShares(prev => prev.filter(s => s.id !== shareId))
        router.refresh()
      } catch {
        router.refresh()
      }
    })
  }

  if (!isOwner && !sharesLoaded) return null
  if (!isOwner && shares.length === 0) return null

  return (
    <>
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-neutral-800">Sharing</h3>
          {isOwner && (
            <Button size="sm" variant="secondary" onClick={handleOpen}>
              <UserPlus className="h-3.5 w-3.5" />
              Share
            </Button>
          )}
        </div>
        <p className="mb-3 text-xs text-neutral-500">
          By default only you, your manager, and admins can see this TACTIC.
          Share with others if they also need access.
        </p>
        {!sharesLoaded ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : shares.length === 0 ? (
          <p className="text-sm text-neutral-400">Not shared with anyone else.</p>
        ) : (
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-100">
            {shares.map(s => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-800">{s.user.full_name}</p>
                  <p className="text-xs text-neutral-400">
                    {s.user.employee_code} · {s.user.role}
                  </p>
                </div>
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => handleUnshare(s.id)}
                    disabled={isPending}
                    className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-danger-600"
                    title="Remove access"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={open}
        onClose={() => { setOpen(false); setError('') }}
        title={`Share ${docCode}`}
        size="sm"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-neutral-600">
            Choose a colleague who should be able to view this TACTIC.
          </p>
          {loadingUsers ? (
            <p className="text-sm text-neutral-400">Loading people…</p>
          ) : users.length === 0 ? (
            <p className="text-sm text-neutral-400">Everyone already has access or no users available.</p>
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
          {error && <p className="text-sm text-danger-600">{error}</p>}
          <DialogFooter>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={handleShare} loading={isPending} disabled={!selected}>
              Share
            </Button>
          </DialogFooter>
        </div>
      </Dialog>
    </>
  )
}
