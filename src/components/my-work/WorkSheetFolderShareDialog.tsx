'use client'

import { useEffect, useState, useTransition } from 'react'
import { Users, X, Eye, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { useToast } from '@/lib/store/toast'
import {
  getShareableUsers,
  listWorkSheetFolderShares,
  shareWorkSheetFolder,
  updateWorkSheetFolderShare,
  removeWorkSheetFolderShare,
} from '@/lib/actions/my-work'
import type { ShareableUser, WorkSheetFolderShare } from '@/lib/my-work/types'
import { cn } from '@/lib/utils'

interface Props {
  folderId:   string
  folderName: string
  open:       boolean
  onClose:    () => void
  onChanged:  () => void
}

export function WorkSheetFolderShareDialog({ folderId, folderName, open, onClose, onChanged }: Props) {
  const toast = useToast()
  const [shares, setShares]           = useState<WorkSheetFolderShare[]>([])
  const [candidates, setCandidates]   = useState<ShareableUser[]>([])
  const [selectedId, setSelectedId]   = useState('')
  const [canEdit, setCanEdit]         = useState(false)
  const [loading, setLoading]         = useState(false)
  const [isPending, start]            = useTransition()

  useEffect(() => {
    if (!open) return
    setLoading(true)
    Promise.all([listWorkSheetFolderShares(folderId), getShareableUsers()])
      .then(([s, users]) => {
        setShares(s)
        setCandidates(users)
      })
      .catch(e => toast.error(e instanceof Error ? e.message : 'Failed to load sharing'))
      .finally(() => setLoading(false))
  }, [open, folderId, toast])

  const sharedIds = new Set(shares.map(s => s.shared_with))
  const available = candidates.filter(u => !sharedIds.has(u.id))

  const handleShare = () => {
    if (!selectedId) return
    start(async () => {
      try {
        const share = await shareWorkSheetFolder(folderId, selectedId, canEdit)
        setShares(prev => [share, ...prev.filter(s => s.shared_with !== share.shared_with)])
        setSelectedId('')
        setCanEdit(false)
        onChanged()
        toast.success(canEdit ? 'Collaborator added' : 'Shared for viewing')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Share failed')
      }
    })
  }

  const toggleEdit = (share: WorkSheetFolderShare) => {
    start(async () => {
      try {
        const next = !share.can_edit
        await updateWorkSheetFolderShare(folderId, share.id, next)
        setShares(prev => prev.map(s => s.id === share.id ? { ...s, can_edit: next } : s))
        onChanged()
        toast.success(next ? 'Collaboration enabled' : 'Changed to view only')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Update failed')
      }
    })
  }

  const handleRemove = (share: WorkSheetFolderShare) => {
    start(async () => {
      try {
        await removeWorkSheetFolderShare(folderId, share.id)
        setShares(prev => prev.filter(s => s.id !== share.id))
        onChanged()
        toast.success('Access removed')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Remove failed')
      }
    })
  }

  return (
    <Dialog open={open} onClose={onClose} title="Share folder" size="md">
      <p className="mb-4 text-sm text-neutral-600">
        Share <strong>{folderName}</strong> with anyone on the team — they get access to every
        sheet and page inside this folder, including anything added later.
        Turn on <strong>Collaborate</strong> so they can edit.
      </p>

      {loading ? (
        <p className="py-6 text-center text-sm text-neutral-400">Loading…</p>
      ) : (
        <>
          {available.length > 0 ? (
            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Add person
              </label>
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="h-9 w-full rounded border border-neutral-300 bg-white px-3 text-sm"
              >
                <option value="">Select a person…</option>
                {available.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.full_name} ({u.role}) — {u.employee_code}
                  </option>
                ))}
              </select>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={canEdit}
                  onChange={e => setCanEdit(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                <Pencil className="h-3.5 w-3.5 text-neutral-500" />
                Collaborate — allow editing
              </label>
              <Button size="sm" disabled={!selectedId} loading={isPending} onClick={handleShare}>
                <Users className="h-3.5 w-3.5" /> Share
              </Button>
            </div>
          ) : (
            <p className="mb-4 text-sm text-neutral-400">
              Everyone available is already shared.
            </p>
          )}

          {shares.length > 0 ? (
            <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {shares.map(share => (
                <li key={share.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-800">
                      {share.user.full_name}
                    </p>
                    <p className="text-xs text-neutral-400 capitalize">
                      {share.user.role} · {share.user.employee_code}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleEdit(share)}
                      disabled={isPending}
                      className={cn(
                        'flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors',
                        share.can_edit
                          ? 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200',
                      )}
                      title={share.can_edit ? 'Can edit — click for view only' : 'View only — click to collaborate'}
                    >
                      {share.can_edit
                        ? <><Pencil className="h-3 w-3" /> Edit</>
                        : <><Eye className="h-3 w-3" /> View</>}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(share)}
                      disabled={isPending}
                      className="rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-danger-600"
                      title="Remove access"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-400">Not shared with anyone yet.</p>
          )}
        </>
      )}

      <DialogFooter>
        <Button variant="secondary" onClick={onClose}>Done</Button>
      </DialogFooter>
    </Dialog>
  )
}
