'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Trash2, Plus, Building2 } from 'lucide-react'
import { DataTable, type TableColumn } from '@/components/ui/DataTable'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { CompanyDialog } from './CompanyDialog'
import { createCompany, updateCompany, deleteCompany } from '@/lib/actions/companies'
import { useToast } from '@/lib/store/toast'
import type { Company } from '@/lib/types'

interface CompaniesTableProps {
  initialCompanies: Company[]
}

export function CompaniesTable({ initialCompanies }: CompaniesTableProps) {
  const router  = useRouter()
  const toast   = useToast()

  const [companies, setCompanies] = useState<Company[]>(initialCompanies)
  const [formOpen,  setFormOpen]  = useState(false)
  const [editing,   setEditing]   = useState<Company | null>(null)
  const [deleting,  setDeleting]  = useState<Company | null>(null)
  const [deleting_,  setDeleting_]  = useState(false)

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSave = async (values: { name: string }) => {
    if (editing) {
      const res = await updateCompany(editing.id, values)
      if (res.error) return res.error
      // Optimistic update
      setCompanies((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...res.data! } : c)))
      toast.success('Company updated')
    } else {
      const res = await createCompany(values)
      if (res.error) return res.error
      setCompanies((prev) => [res.data!, ...prev])
      toast.success('Company created')
    }
    router.refresh()
    return null
  }

  const handleDelete = async () => {
    if (!deleting) return
    setDeleting_(true)
    const res = await deleteCompany(deleting.id)
    setDeleting_(false)
    if (res.error) {
      toast.error(res.error)
      return
    }
    setCompanies((prev) => prev.filter((c) => c.id !== deleting.id))
    setDeleting(null)
    toast.success('Company deleted')
    router.refresh()
  }

  // ── Columns ───────────────────────────────────────────────────────────────

  const columns: TableColumn<Company>[] = [
    {
      accessorKey: 'code',
      header: 'Code',
      cell: ({ getValue }) => (
        <span className="font-mono text-xs font-semibold text-neutral-500">
          {getValue<string>()}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Company name',
      cell: ({ getValue }) => (
        <span className="flex items-center gap-2 font-medium text-neutral-900">
          <Building2 className="h-3.5 w-3.5 text-neutral-400" />
          {getValue<string>()}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ getValue }) => (
        <span className="text-neutral-500">
          {new Date(getValue<string>()).toLocaleDateString()}
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
            variant="ghost"
            size="sm"
            onClick={() => { setEditing(row.original); setFormOpen(true) }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
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
        data={companies}
        columns={columns}
        searchPlaceholder="Search companies…"
        emptyMessage="No companies yet. Create the first one."
        toolbar={
          <Button
            size="sm"
            onClick={() => { setEditing(null); setFormOpen(true) }}
          >
            <Plus className="h-3.5 w-3.5" />
            New company
          </Button>
        }
      />

      {/* Create / Edit dialog */}
      <CompanyDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        onSave={handleSave}
        company={editing}
      />

      {/* Delete confirmation */}
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete company?"
        description={`"${deleting?.name}" (${deleting?.code}) will be permanently removed.`}
        size="sm"
      >
        <p className="text-sm text-neutral-600">
          This action cannot be undone. Make sure all teams, projects, and clients have
          been reassigned or removed first.
        </p>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button variant="destructive" loading={deleting_} onClick={handleDelete}>
            Delete
          </Button>
        </DialogFooter>
      </Dialog>
    </>
  )
}
