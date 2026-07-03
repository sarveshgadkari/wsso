'use client'

import { useState, useRef, useTransition } from 'react'
import {
  Plus, Upload, Table2, FileSpreadsheet, FileText, LayoutTemplate,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/lib/store/toast'
import {
  uploadWorkSheetExcel,
  createBlankWorkSheet,
  createDocumentWorkSheet,
} from '@/lib/actions/my-work'
import { WorkSheetGrid } from './WorkSheetGrid'
import { WorkDocumentEditor } from './WorkDocumentEditor'
import type { WorkSheet, WorkOrderOption } from '@/lib/my-work/types'
import { cn } from '@/lib/utils'

interface Props {
  initialSheets: WorkSheet[]
  workOrders:    WorkOrderOption[]
}

function SheetIcon({ sheet }: { sheet: WorkSheet }) {
  if (sheet.sheet_type === 'document') {
    return <FileText className="h-4 w-4 shrink-0 opacity-60" />
  }
  return <FileSpreadsheet className="h-4 w-4 shrink-0 opacity-60" />
}

export function MyWorkShell({ initialSheets, workOrders }: Props) {
  const toast = useToast()
  const [sheets, setSheets]         = useState(initialSheets)
  const [selectedId, setSelectedId] = useState(initialSheets[0]?.id ?? '')
  const [uploadOpen, setUploadOpen]   = useState(false)
  const [gridOpen, setGridOpen]       = useState(false)
  const [docOpen, setDocOpen]         = useState(false)
  const [sheetName, setSheetName]     = useState('')
  const [file, setFile]               = useState<File | null>(null)
  const [isPending, start]            = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const selected = sheets.find(s => s.id === selectedId) ?? sheets[0]

  const handleUpload = () => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    if (sheetName.trim()) fd.append('name', sheetName.trim())

    start(async () => {
      try {
        const sheet = await uploadWorkSheetExcel(fd)
        setSheets(prev => [sheet, ...prev])
        setSelectedId(sheet.id)
        setUploadOpen(false)
        setFile(null)
        setSheetName('')
        if (fileRef.current) fileRef.current.value = ''
        toast.success(`Imported "${sheet.name}"`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Upload failed')
      }
    })
  }

  const handleCreateGrid = () => {
    start(async () => {
      try {
        const sheet = await createBlankWorkSheet(sheetName.trim() || 'My spreadsheet')
        setSheets(prev => [sheet, ...prev])
        setSelectedId(sheet.id)
        setGridOpen(false)
        setSheetName('')
        toast.success('Spreadsheet created')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Create failed')
      }
    })
  }

  const handleCreateDoc = () => {
    start(async () => {
      try {
        const sheet = await createDocumentWorkSheet(sheetName.trim() || 'Untitled page')
        setSheets(prev => [sheet, ...prev])
        setSelectedId(sheet.id)
        setDocOpen(false)
        setSheetName('')
        toast.success('Page created')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Create failed')
      }
    })
  }

  const onSheetDelete = (id: string) => {
    setSheets(prev => {
      const next = prev.filter(s => s.id !== id)
      if (selectedId === id) setSelectedId(next[0]?.id ?? '')
      return next
    })
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-56">
        <div className="card p-3">
          <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            My work
          </p>
          <ul className="flex flex-col gap-0.5">
            {sheets.map(s => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors',
                    selected?.id === s.id
                      ? 'bg-primary-50 font-medium text-primary-800'
                      : 'text-neutral-700 hover:bg-neutral-50',
                  )}
                >
                  <SheetIcon sheet={s} />
                  <span className="truncate">{s.name}</span>
                </button>
              </li>
            ))}
          </ul>
          {sheets.length === 0 && (
            <p className="px-2 py-3 text-xs text-neutral-400">Nothing here yet</p>
          )}
          <div className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={() => { setSheetName(''); setUploadOpen(true) }}
            >
              <Upload className="h-3.5 w-3.5" /> Upload Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={() => { setSheetName(''); setDocOpen(true) }}
            >
              <LayoutTemplate className="h-3.5 w-3.5" /> New Notion page
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={() => { setSheetName(''); setGridOpen(true) }}
            >
              <Plus className="h-3.5 w-3.5" /> New spreadsheet
            </Button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {selected ? (
          selected.sheet_type === 'document' ? (
            <WorkDocumentEditor
              key={selected.id}
              sheet={selected}
              onSheetChange={updated => {
                setSheets(prev => prev.map(s => s.id === updated.id ? updated : s))
              }}
              onSheetDelete={onSheetDelete}
            />
          ) : (
            <WorkSheetGrid
              key={selected.id}
              sheet={selected}
              workOrders={workOrders}
              onSheetChange={updated => {
                setSheets(prev => prev.map(s => s.id === updated.id ? updated : s))
              }}
              onSheetDelete={onSheetDelete}
            />
          )
        ) : (
          <div className="card flex flex-col items-center gap-4 px-6 py-16 text-center">
            <Table2 className="h-12 w-12 text-neutral-300" />
            <div>
              <p className="font-medium text-neutral-800">Your personal workspace</p>
              <p className="mt-1 max-w-md text-sm text-neutral-500">
                <strong>Upload Excel</strong> for existing work (table view).
                <strong> New Notion page</strong> for notes, tasks, and research like Google Docs.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setUploadOpen(true)}>
                <Upload className="h-4 w-4" /> Upload Excel
              </Button>
              <Button variant="secondary" onClick={() => setDocOpen(true)}>
                <LayoutTemplate className="h-4 w-4" /> Notion page
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload Excel">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            Import an existing spreadsheet. Row 1 = headers. Opens as an editable table (Excel-style).
          </p>
          <Input
            label="Name (optional)"
            placeholder="Research log 2024"
            value={sheetName}
            onChange={e => setSheetName(e.target.value)}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Excel file</label>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setUploadOpen(false)}>Cancel</Button>
          <Button loading={isPending} disabled={!file} onClick={handleUpload}>Upload</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={docOpen} onClose={() => setDocOpen(false)} title="New Notion-style page">
        <p className="mb-3 text-sm text-neutral-600">
          Free-form page with headings, bullets, to-dos — like Notion. Great for new work and notes.
        </p>
        <Input
          label="Page title"
          placeholder="My research notes"
          value={sheetName}
          onChange={e => setSheetName(e.target.value)}
        />
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDocOpen(false)}>Cancel</Button>
          <Button loading={isPending} onClick={handleCreateDoc}>Create page</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={gridOpen} onClose={() => setGridOpen(false)} title="New spreadsheet">
        <Input
          label="Name"
          placeholder="Task tracker"
          value={sheetName}
          onChange={e => setSheetName(e.target.value)}
        />
        <DialogFooter>
          <Button variant="secondary" onClick={() => setGridOpen(false)}>Cancel</Button>
          <Button loading={isPending} onClick={handleCreateGrid}>Create</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
