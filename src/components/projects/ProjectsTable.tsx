'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Eye } from 'lucide-react'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ProjectDialog, type ProjectRow } from './ProjectDialog'
import type { Company, Client, Profile } from '@/lib/types'

const STATUS_VARIANT = {
  active:    'success',
  on_hold:   'warning',
  completed: 'default',
} as const

const STATUS_LABEL = {
  active:    'Active',
  on_hold:   'On hold',
  completed: 'Completed',
} as const

interface Props {
  initialProjects: ProjectRow[]
  companies:       Pick<Company, 'id' | 'name' | 'code'>[]
  clients:         (Pick<Client,  'id' | 'name' | 'code'> & { company_id: string })[]
  managers:        Pick<Profile,  'id' | 'full_name' | 'employee_code'>[]
  isAdmin:         boolean
  currentUserId:   string
}

export function ProjectsTable({
  initialProjects, companies, clients, managers, isAdmin, currentUserId,
}: Props) {
  const router = useRouter()

  const [projects,     setProjects]    = useState<ProjectRow[]>(initialProjects)
  const [dialogOpen,   setDialog]      = useState(false)
  const [editing,      setEditing]     = useState<ProjectRow | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = useMemo(
    () =>
      statusFilter === 'all'
        ? projects
        : projects.filter((p) => p.status === statusFilter),
    [projects, statusFilter],
  )

  const openCreate = () => { setEditing(null); setDialog(true) }
  const openEdit   = (p: ProjectRow) => { setEditing(p); setDialog(true) }

  const handleSaved = (saved: ProjectRow) => {
    setProjects((prev) =>
      editing
        ? prev.map((p) => (p.id === saved.id ? saved : p))
        : [saved, ...prev],
    )
    setDialog(false)
    router.refresh()
  }

  const columns: TableColumn<ProjectRow>[] = [
    {
      id: 'project',
      accessorFn: (r) => `${r.name} ${r.code}`,
      header: 'Project',
      cell: ({ row: { original: p } }) => (
        <div>
          <p className="font-medium text-neutral-900">{p.name}</p>
          <p className="font-mono text-[11px] text-neutral-400">{p.code}</p>
        </div>
      ),
    },
    {
      id: 'company',
      accessorFn: (r) => r.company?.name ?? '',
      header: 'Company',
      cell: ({ row: { original: p } }) =>
        p.company ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-neutral-400">{p.company.code}</span>
            <span className="text-sm">{p.company.name}</span>
          </div>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      id: 'client',
      accessorFn: (r) => r.client?.name ?? '',
      header: 'Client',
      cell: ({ row: { original: p } }) =>
        p.client ? (
          <div>
            <span className="text-sm">{p.client.name}</span>
            <span className="font-mono ml-1.5 text-[11px] text-neutral-400">
              {p.client.code}
            </span>
          </div>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      id: 'manager',
      accessorFn: (r) => r.manager?.full_name ?? '',
      header: 'Manager',
      cell: ({ row: { original: p } }) =>
        p.manager ? (
          <span className="text-sm">{p.manager.full_name}</span>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const s = getValue<keyof typeof STATUS_VARIANT>()
        return (
          <Badge variant={STATUS_VARIANT[s] ?? 'default'}>
            {STATUS_LABEL[s] ?? s}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/projects/${row.original.id}`)}
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      ),
    },
  ]

  const toolbar = (
    <>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="h-8 appearance-none rounded border border-neutral-300 bg-white pl-2 pr-6 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="all">All statuses</option>
        <option value="active">Active</option>
        <option value="on_hold">On hold</option>
        <option value="completed">Completed</option>
      </select>

      <Button size="sm" onClick={openCreate}>
        <Plus className="h-3.5 w-3.5" />
        New project
      </Button>
    </>
  )

  return (
    <>
      <DataTable
        data={filtered}
        columns={columns}
        searchPlaceholder="Search projects…"
        emptyMessage="No projects found."
        toolbar={toolbar}
      />

      <ProjectDialog
        open={dialogOpen}
        onClose={() => setDialog(false)}
        onSaved={handleSaved}
        project={editing}
        companies={companies}
        clients={clients}
        managers={managers}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
      />
    </>
  )
}
