'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { bulkCreateLeads } from '@/lib/actions/leads'
import { LEAD_CSV_TEMPLATE, parseLeadCsv } from '@/lib/leads-utils'

export function BulkUploadLeadsDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ created: number; skipped: number; errors: { row: number; message: string }[] } | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const downloadTemplate = () => {
    const blob = new Blob([LEAD_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'wsso-leads-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onFile = async (file: File | undefined) => {
    setError(null)
    setResult(null)
    if (!file) return
    setFileName(file.name)
    const text = await file.text()
    const parsed = parseLeadCsv(text)
    if (parsed.error) {
      setError(parsed.error)
      return
    }
    setBusy(true)
    try {
      const out = await bulkCreateLeads(parsed.rows)
      setResult(out)
      if (out.created > 0) onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Bulk upload leads"
      description="Upload a CSV. Required columns: first_name, last_name, email. Up to 500 rows."
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={downloadTemplate}
          className="inline-flex items-center gap-2 self-start text-sm font-medium text-primary-700 hover:underline"
        >
          <Download className="h-4 w-4" />
          Download CSV template
        </button>

        <label className="flex cursor-pointer flex-col items-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50 px-4 py-8 text-center hover:border-primary-400 hover:bg-primary-50/40">
          <p className="text-sm font-medium text-neutral-800">Choose a .csv file</p>
          <p className="mt-1 text-xs text-neutral-500">{fileName ?? 'first_name, last_name, email, company, inquiry_type, message'}</p>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={busy}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>

        {busy && <p className="text-sm text-neutral-500">Importing…</p>}
        {error && (
          <p className="rounded-md border border-danger-500/30 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
        )}
        {result && (
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3 text-sm">
            <p className="font-medium text-neutral-900">
              Imported {result.created} lead{result.created === 1 ? '' : 's'}
              {result.skipped > 0 ? ` · ${result.skipped} row${result.skipped === 1 ? '' : 's'} skipped` : ''}
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-danger-700">
                {result.errors.slice(0, 20).map((e) => (
                  <li key={`${e.row}-${e.message}`}>Row {e.row}: {e.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            Close
          </Button>
        </DialogFooter>
      </div>
    </Dialog>
  )
}
