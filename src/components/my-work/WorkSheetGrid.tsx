'use client'

import { useState, useCallback, useEffect, useTransition } from 'react'
import Link from 'next/link'
import {
  Plus, Trash2, Save, ExternalLink,
  ClipboardPlus, Link2, WrapText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { useToast } from '@/lib/store/toast'
import {
  updateWorkSheet,
  deleteWorkSheet,
  createWorkOrderFromRow,
  linkRowToWorkOrder,
} from '@/lib/actions/my-work'
import type { WorkSheet, WorkSheetRow, WorkOrderOption } from '@/lib/my-work/types'

interface Props {
  sheet:       WorkSheet
  workOrders:    WorkOrderOption[]
  onSheetChange: (sheet: WorkSheet) => void
  onSheetDelete: (id: string) => void
}

function newRow(columns: string[]): WorkSheetRow {
  const cells: Record<string, string> = {}
  columns.forEach(c => { cells[c] = '' })
  return { id: crypto.randomUUID(), cells, tactic_id: null }
}

const WRAP_PREF_KEY = 'wsso:my-work:wrap-text'

function autoSize(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

export function WorkSheetGrid({ sheet, workOrders, onSheetChange, onSheetDelete }: Props) {
  const toast = useToast()
  const [columns, setColumns] = useState(sheet.columns)
  const [rows, setRows]       = useState<WorkSheetRow[]>(sheet.rows)
  const [dirty, setDirty]     = useState(false)
  const [isPending, start]    = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [wrapText, setWrapText] = useState(false)

  // Load the saved preference after mount to avoid SSR hydration mismatch.
  useEffect(() => {
    setWrapText(localStorage.getItem(WRAP_PREF_KEY) === '1')
  }, [])

  const toggleWrap = () => {
    setWrapText(prev => {
      const next = !prev
      localStorage.setItem(WRAP_PREF_KEY, next ? '1' : '0')
      return next
    })
  }

  const markDirty = useCallback(() => setDirty(true), [])

  const updateCell = (rowId: string, col: string, value: string) => {
    setRows(prev => prev.map(r =>
      r.id === rowId ? { ...r, cells: { ...r.cells, [col]: value } } : r,
    ))
    markDirty()
  }

  const addRow = () => {
    setRows(prev => [...prev, newRow(columns)])
    markDirty()
  }

  const removeRow = (rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId))
    markDirty()
  }

  const addColumn = () => {
    const name = `Column ${columns.length + 1}`
    setColumns(prev => [...prev, name])
    setRows(prev => prev.map(r => ({ ...r, cells: { ...r.cells, [name]: '' } })))
    markDirty()
  }

  const save = () => {
    start(async () => {
      try {
        const updated = await updateWorkSheet(sheet.id, { columns, rows })
        onSheetChange(updated)
        setDirty(false)
        toast.success('Sheet saved')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Save failed')
      }
    })
  }

  const handleCreateWO = (rowId: string) => {
    start(async () => {
      try {
        if (dirty) {
          const saved = await updateWorkSheet(sheet.id, { columns, rows })
          onSheetChange(saved)
          setDirty(false)
        }
        const { sheet: updated, tactic } = await createWorkOrderFromRow(sheet.id, rowId)
        setRows(updated.rows)
        onSheetChange(updated)
        toast.success(`Work order ${tactic.code} created`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to create work order')
      }
    })
  }

  const handleLinkWO = (rowId: string, tacticId: string) => {
    start(async () => {
      try {
        if (dirty) await updateWorkSheet(sheet.id, { columns, rows })
        const updatedRows = await linkRowToWorkOrder(
          sheet.id,
          rowId,
          tacticId || null,
        )
        setRows(updatedRows)
        setDirty(false)
        onSheetChange({ ...sheet, columns, rows: updatedRows })
        toast.success(tacticId ? 'Linked to work order' : 'Link removed')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Link failed')
      }
    })
  }

  const confirmDelete = () => {
    start(async () => {
      try {
        await deleteWorkSheet(sheet.id)
        onSheetDelete(sheet.id)
        setDeleteOpen(false)
        toast.success('Sheet deleted')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Delete failed')
      }
    })
  }

  const linkedTactic = (id: string | null | undefined) =>
    workOrders.find(t => t.id === id)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">{sheet.name}</h3>
          {sheet.source_filename && (
            <p className="text-xs text-neutral-400">Imported from {sheet.source_filename}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={toggleWrap}
            className={cn(wrapText && 'border-primary-300 bg-primary-50 text-primary-700 hover:bg-primary-100')}
            title={wrapText ? 'Show each cell on a single line' : 'Wrap long text inside cells (like Excel)'}
          >
            <WrapText className="h-3.5 w-3.5" /> Wrap
          </Button>
          <Button variant="secondary" size="sm" onClick={addColumn} disabled={isPending}>
            <Plus className="h-3.5 w-3.5" /> Column
          </Button>
          <Button variant="secondary" size="sm" onClick={addRow} disabled={isPending}>
            <Plus className="h-3.5 w-3.5" /> Row
          </Button>
          <Button size="sm" onClick={save} loading={isPending} disabled={!dirty}>
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              {columns.map(col => (
                <th key={col} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {col}
                </th>
              ))}
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Work order
              </th>
              <th className="w-24 px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-5 py-8 text-center text-neutral-400">
                  No rows yet — click <strong>Add Row</strong> or edit cells after import.
                </td>
              </tr>
            ) : rows.map(row => {
              const linked = linkedTactic(row.tactic_id)
              return (
                <tr key={row.id} className="hover:bg-neutral-50/80">
                  {columns.map(col => (
                    <td key={col} className={cn('p-1', wrapText && 'align-top')}>
                      {wrapText ? (
                        <textarea
                          key={`${col}-wrap`}
                          ref={autoSize}
                          rows={1}
                          className="block w-full min-w-[120px] max-w-[360px] resize-none overflow-hidden whitespace-pre-wrap break-words rounded border border-transparent bg-transparent px-2 py-1.5 text-sm leading-snug focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-200"
                          value={row.cells[col] ?? ''}
                          onChange={e => {
                            updateCell(row.id, col, e.target.value)
                            autoSize(e.target)
                          }}
                        />
                      ) : (
                        <input
                          className="w-full min-w-[120px] rounded border border-transparent bg-transparent px-2 py-1.5 text-sm focus:border-primary-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-primary-200"
                          value={row.cells[col] ?? ''}
                          onChange={e => updateCell(row.id, col, e.target.value)}
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-2 align-top">
                    <div className="flex min-w-[160px] flex-col gap-1">
                      {linked ? (
                        <Link
                          href={`/tactics/${linked.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"
                        >
                          {linked.code}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-xs text-neutral-300">—</span>
                      )}
                      <select
                        className="h-8 w-full rounded border border-neutral-200 bg-white px-2 text-xs"
                        value={row.tactic_id ?? ''}
                        onChange={e => handleLinkWO(row.id, e.target.value)}
                        disabled={isPending}
                      >
                        <option value="">Link existing…</option>
                        {workOrders.map(t => (
                          <option key={t.id} value={t.id}>{t.code} — {t.title}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="p-2 align-top">
                    <div className="flex flex-col gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 justify-start px-2 text-xs"
                        onClick={() => handleCreateWO(row.id)}
                        disabled={isPending}
                        title="Create work order from this row"
                      >
                        <ClipboardPlus className="h-3.5 w-3.5" />
                        Create WO
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 justify-start px-2 text-xs text-danger-600"
                        onClick={() => removeRow(row.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-neutral-400">
        <Link2 className="mr-1 inline h-3 w-3" />
        Link a row to an existing work order, or <strong>Create WO</strong> to turn a row into a new personal work order.
      </p>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete sheet?">
        <p className="text-sm text-neutral-600">
          Delete <strong>{sheet.name}</strong>? This cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="destructive" loading={isPending} onClick={confirmDelete}>Delete</Button>
        </DialogFooter>
      </Dialog>
    </div>
  )
}
