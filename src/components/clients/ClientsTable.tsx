'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus } from 'lucide-react'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ClientDialog } from './ClientDialog'
import type { Client, Company } from '@/lib/types'

export interface ClientRow extends Client {
  company: Pick<Company, 'id' | 'name' | 'code'>
}

interface Props {
  initialClients: ClientRow[]
  companies:      Pick<Company, 'id' | 'name' | 'code'>[]
}

export function ClientsTable({ initialClients, companies }: Props) {
  const router = useRouter()
  const [clients,  setClients]  = useState<ClientRow[]>(initialClients)
  const [dialogOpen, setDialog] = useState(false)
  const [editing,  setEditing]  = useState<ClientRow | null>(null)
  const [statusFilter, setStatus] = useState<'all' | 'active' | 'inactive'>('active')

  const filtered = useMemo(
    () =>
      statusFilter === 'all'
        ? clients
        : clients.filter((c) => c.status === statusFilter),
    [clients, statusFilter],
  )

  const openCreate = () => { setEditing(null); setDialog(true) }
  const openEdit   = (c: ClientRow) => { setEditing(c); setDialog(true) }

  const handleSaved = (saved: Client) => {
    // Find the company to denorm
    const company = companies.find((c) => c.id === saved.company_id)!
    const row: ClientRow = { ...saved, company }

    setClients((prev) =>
      editing
        ? prev.map((c) => (c.id === saved.id ? row : c))
        : [row, ...prev],
    )
    setDialog(false)
    router.refresh()
  }

  const columns: TableColumn<ClientRow>[] = [
    {
      id: 'client',
      accessorFn: (r) => `${r.name} ${r.code}`,
      header: 'Client',
      cell: ({ row: { original: c } }) => (
        <div>
          <p className="font-medium text-neutral-900">{c.name}</p>
          <p className="font-mono text-[11px] text-neutral-400">{c.code}</p>
        </div>
      ),
    },
    {
      id: 'company',
      accessorFn: (r) => r.company?.name ?? '',
      header: 'Company',
      cell: ({ row: { original: c } }) =>
        c.company ? (
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-neutral-400">{c.company.code}</span>
            <span className="text-sm">{c.company.name}</span>
          </div>
        ) : (
          <span className="text-neutral-400">—</span>
        ),
    },
    {
      id: 'contact',
      accessorFn: (r) => `${r.contact_name ?? ''} ${r.contact_email ?? ''}`,
      header: 'Contact',
      cell: ({ row: { original: c } }) => (
        <div>
          {c.contact_name  && <p className="text-sm">{c.contact_name}</p>}
          {c.contact_email && (
            <a
              href={`mailto:${c.contact_email}`}
              className="text-xs text-primary-600 hover:underline"
            >
              {c.contact_email}
            </a>
          )}
          {c.contact_phone && (
            <p className="text-xs text-neutral-400">{c.contact_phone}</p>
          )}
          {!c.contact_name && !c.contact_email && !c.contact_phone && (
            <span className="text-neutral-400">—</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => {
        const s = getValue<string>()
        return (
          <Badge variant={s === 'active' ? 'success' : 'warning'} className="capitalize">
            {s}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Button>
      ),
    },
  ]

  const toolbar = (
    <>
      <select
        value={statusFilter}
        onChange={(e) => setStatus(e.target.value as typeof statusFilter)}
        className="h-8 appearance-none rounded border border-neutral-300 bg-white pl-2 pr-6 text-xs text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
      >
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
        <option value="all">All statuses</option>
      </select>

      <Button size="sm" onClick={openCreate}>
        <Plus className="h-3.5 w-3.5" />
        New client
      </Button>
    </>
  )

  return (
    <>
      <DataTable
        data={filtered}
        columns={columns}
        searchPlaceholder="Search clients…"
        emptyMessage="No clients found."
        toolbar={toolbar}
      />

      <ClientDialog
        open={dialogOpen}
        onClose={() => setDialog(false)}
        onSaved={handleSaved}
        client={editing}
        companies={companies}
      />
    </>
  )
}
