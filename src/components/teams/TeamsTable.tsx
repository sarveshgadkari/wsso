'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Plus, Users } from 'lucide-react'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Badge } from '@/components/ui/Badge'
import { TeamDialog, type TeamRow } from './TeamDialog'
import { createTeam, updateTeam, deleteTeam } from '@/lib/actions/teams'
import { useToast } from '@/lib/store/toast'
import type { Company, Profile } from '@/lib/types'

interface TeamsTableProps {
  initialTeams: (TeamRow & { memberCount: number })[]
  companies:    Pick<Company, 'id' | 'name' | 'code'>[]
  managers:     Pick<Profile, 'id' | 'full_name' | 'employee_code'>[]
}

export function TeamsTable({ initialTeams, companies, managers }: TeamsTableProps) {
  const router = useRouter()
  const toast  = useToast()

  type TRow = TeamRow & { memberCount: number }
  const [teams,    setTeams]    = useState<TRow[]>(initialTeams)
  const [formOpen, setFormOpen] = useState(false)
  const [editing,  setEditing]  = useState<TRow | null>(null)
  const [deleting, setDeleting] = useState<TRow | null>(null)
  const [delBusy,  setDelBusy]  = useState(false)

  const handleSave = async (values: { name: string; company_id: string; manager_id?: string | null }) => {
    if (editing) {
      const res = await updateTeam(editing.id, values)
      if (res.error) return res.error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updated = res.data as any
      setTeams((prev) =>
        prev.map((t) =>
          t.id === editing.id
            ? { ...t, ...updated, memberCount: t.memberCount }
            : t
        )
      )
      toast.success('Team updated')
    } else {
      const res = await createTeam(values)
      if (res.error) return res.error
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTeams((prev) => [{ ...(res.data as any), memberCount: 0 }, ...prev])
      toast.success('Team created')
    }
    router.refresh()
    return null
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDelBusy(true)
    const res = await deleteTeam(deleting.id)
    setDelBusy(false)
    if (res.error) { toast.error(res.error); return }
    setTeams((prev) => prev.filter((t) => t.id !== deleting.id))
    setDeleting(null)
    toast.success('Team deleted')
    router.refresh()
  }

  const columns: TableColumn<TRow>[] = [
    {
      accessorKey: 'code',
      header: 'Code',
      cell: ({ getValue }) => (
        <span className="font-mono text-xs font-semibold text-neutral-500">{getValue<string>()}</span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Team name',
      cell: ({ getValue }) => (
        <span className="font-medium text-neutral-900">{getValue<string>()}</span>
      ),
    },
    {
      id: 'company',
      header: 'Company',
      accessorFn: (row) => row.company?.name ?? '—',
      cell: ({ row }) =>
        row.original.company ? (
          <span className="text-sm">
            <span className="font-mono text-xs text-neutral-400 mr-1">
              {row.original.company.code}
            </span>
            {row.original.company.name}
          </span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      id: 'manager',
      header: 'Manager',
      accessorFn: (row) => row.manager?.full_name ?? '',
      cell: ({ row }) =>
        row.original.manager ? (
          <span className="text-sm">{row.original.manager.full_name}</span>
        ) : (
          <Badge variant="warning">No manager</Badge>
        ),
    },
    {
      accessorKey: 'memberCount',
      header: 'Members',
      cell: ({ getValue }) => (
        <span className="flex items-center gap-1.5 text-sm">
          <Users className="h-3.5 w-3.5 text-neutral-400" />
          {getValue<number>()}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost" size="sm"
            onClick={() => { setEditing(row.original); setFormOpen(true) }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => setDeleting(row.original)}
            className="text-danger-500 hover:text-danger-700 hover:bg-danger-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <DataTable
        data={teams}
        columns={columns}
        searchPlaceholder="Search teams…"
        emptyMessage="No teams yet. Create one to start assigning employees."
        toolbar={
          <Button size="sm" onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="h-3.5 w-3.5" />
            New team
          </Button>
        }
      />

      <TeamDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        onSave={handleSave}
        team={editing}
        companies={companies}
        managers={managers}
      />

      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete team?"
        size="sm"
      >
        <p className="text-sm text-neutral-600">
          <strong>{deleting?.name}</strong> will be permanently removed. All member assignments
          to this team will be cleared.
        </p>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button>
          <Button variant="destructive" loading={delBusy} onClick={handleDelete}>Delete</Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
