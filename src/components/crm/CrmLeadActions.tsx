'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Handshake, Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { AddLeadDialog } from './AddLeadDialog'
import { BulkUploadLeadsDialog } from './BulkUploadLeadsDialog'

export function CrmLeadActions({ compact = false }: { compact?: boolean }) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)
  const refresh = () => router.refresh()

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add lead
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setBulkOpen(true)}>
          <Upload className="h-4 w-4" />
          Bulk upload
        </Button>
        {compact && (
          <Link href="/crm" className="text-sm font-medium text-primary-700 hover:underline">
            Open CRM
          </Link>
        )}
      </div>
      <AddLeadDialog open={addOpen} onClose={() => setAddOpen(false)} onSaved={refresh} />
      <BulkUploadLeadsDialog open={bulkOpen} onClose={() => setBulkOpen(false)} onSaved={refresh} />
    </>
  )
}

export function CrmDashboardCard({ newCount }: { newCount: number }) {
  return (
    <div className="card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-50">
            <Handshake className="h-5 w-5 text-primary-700" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">CRM leads</h3>
            <p className="mt-0.5 text-xs text-neutral-500">
              {newCount} new · add one or upload a CSV from the dashboard
            </p>
          </div>
        </div>
        <CrmLeadActions compact />
      </div>
    </div>
  )
}
