'use client'

import { memo, useState, useCallback, useEffect, useRef, useTransition } from 'react'
import Link from 'next/link'
import {
  Plus, Trash2, Save, ExternalLink,
  ClipboardPlus, Link2, WrapText, Users, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/lib/store/toast'
import {
  updateWorkSheet,
  deleteWorkSheet,
  createWorkOrderFromRow,
  linkRowToWorkOrder,
} from '@/lib/actions/my-work'
import type { WorkSheet, WorkSheetRow, WorkOrderOption, WorkSheetAccess } from '@/lib/my-work/types'
import { WorkSheetShareDialog } from './WorkSheetShareDialog'

interface Props {
  sheet:       WorkSheet
  access:      WorkSheetAccess
  workOrders:    WorkOrderOption[]
  onSheetChange: (sheet: WorkSheet) => void
  onSheetDelete: (id: string) => void
  onShareChange: () => void
}

function newRow(columns: string[]): WorkSheetRow {
  const cells: Record<string, string> = {}
  columns.forEach(c => { cells[c] = '' })
  return { id: crypto.randomUUID(), cells, tactic_id: null }
}

const WRAP_PREF_KEY = 'wsso:my-work:wrap-text'
const LARGE_SHEET_THRESHOLD = 100
const ROW_PAGE_SIZE = 80

const MIN_COL_WIDTH     = 60
const MAX_COL_WIDTH     = 900
const DEFAULT_COL_WIDTH = 160

const MIN_ROW_HEIGHT     = 28
const MAX_ROW_HEIGHT     = 400
const DEFAULT_ROW_HEIGHT = 36

function autoSize(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

function colStyle(colWidths: Record<string, number>, col: string) {
  const w = colWidths[col]
  return w ? { width: w, minWidth: w, maxWidth: w } : undefined
}

function rowStyle(rowHeights: Record<string, number>, rowId: string) {
  const h = rowHeights[rowId]
  return h ? { height: h, minHeight: h } : undefined
}

interface GridRowProps {
  row:          WorkSheetRow
  rowIdx:       number
  columns:      string[]
  colWidths:    Record<string, number>
  rowHeights:   Record<string, number>
  wrapText:     boolean
  canEdit:      boolean
  isPending:    boolean
  linked:       WorkOrderOption | undefined
  onUpdateCell: (rowId: string, col: string, value: string) => void
  onRemoveRow:  (rowId: string) => void
  onLinkClick:  (rowId: string) => void
  onCreateWO:   (rowId: string) => void
  onResizeRow:  (rowId: string, e: React.PointerEvent) => void
}

const GridRow = memo(function GridRow({
  row,
  rowIdx,
  columns,
  colWidths,
  rowHeights,
  wrapText,
  canEdit,
  isPending,
  linked,
  onUpdateCell,
  onRemoveRow,
  onLinkClick,
  onCreateWO,
  onResizeRow,
}: GridRowProps) {
  const fixedRowHeight = rowHeights[row.id] != null
  const trStyle = rowStyle(rowHeights, row.id)

  return (
    <tr className="group/row" style={trStyle}>
      <td
        style={trStyle}
        className="relative border border-neutral-300 bg-neutral-50 px-2 py-1.5 text-center align-top text-xs text-neutral-400 select-none"
      >
        {canEdit ? (
          <>
            <span className="group-hover/row:invisible">{rowIdx + 1}</span>
            <button
              type="button"
              onClick={() => onRemoveRow(row.id)}
              className="absolute inset-0 flex items-center justify-center text-danger-500 opacity-0 transition-opacity hover:bg-danger-50 group-hover/row:opacity-100"
              title="Delete row"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          rowIdx + 1
        )}
        {canEdit && (
          <div
            onPointerDown={e => onResizeRow(row.id, e)}
            className="absolute -bottom-[3px] left-0 right-0 z-10 h-1.5 cursor-row-resize touch-none select-none hover:bg-primary-400/70 active:bg-primary-500"
            title="Drag to resize row"
          />
        )}
      </td>
      {columns.map(col => (
        <td key={col} style={{ ...colStyle(colWidths, col), ...trStyle }} className="border border-neutral-300 p-0 align-top">
          {wrapText ? (
            <textarea
              rows={1}
              readOnly={!canEdit}
              className={cn(
                'block w-full resize-none border-0 bg-transparent px-2.5 py-1.5 text-sm leading-snug focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500',
                fixedRowHeight
                  ? 'h-full min-h-0 overflow-auto whitespace-pre-wrap break-words'
                  : 'overflow-hidden whitespace-pre-wrap break-words',
                !colWidths[col] && !fixedRowHeight && 'min-w-[140px] max-w-[420px]',
                !canEdit && 'cursor-default',
              )}
              value={row.cells[col] ?? ''}
              onFocus={e => { if (!fixedRowHeight) autoSize(e.currentTarget) }}
              onChange={e => {
                onUpdateCell(row.id, col, e.target.value)
                if (!fixedRowHeight) autoSize(e.target)
              }}
            />
          ) : (
            <input
              readOnly={!canEdit}
              className={cn(
                'block w-full border-0 bg-transparent px-2.5 py-1.5 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500',
                fixedRowHeight && 'h-full min-h-0',
                !colWidths[col] && 'min-w-[140px]',
                !canEdit && 'cursor-default',
              )}
              value={row.cells[col] ?? ''}
              onChange={e => onUpdateCell(row.id, col, e.target.value)}
            />
          )}
        </td>
      ))}
      <td style={trStyle} className="border border-neutral-300 p-2 align-top">
        <div className="flex min-w-[120px] flex-col gap-1">
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
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 justify-start px-1 text-xs"
              onClick={() => onLinkClick(row.id)}
              disabled={isPending}
            >
              <Link2 className="h-3 w-3" />
              {linked ? 'Change link' : 'Link…'}
            </Button>
          )}
        </div>
      </td>
      <td style={trStyle} className="border border-neutral-300 p-2 align-top">
        {canEdit ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 justify-start px-2 text-xs"
            onClick={() => onCreateWO(row.id)}
            disabled={isPending}
            title="Create work order from this row"
          >
            <ClipboardPlus className="h-3.5 w-3.5" />
            Create WO
          </Button>
        ) : null}
      </td>
    </tr>
  )
})

export function WorkSheetGrid({ sheet, access, workOrders, onSheetChange, onSheetDelete, onShareChange }: Props) {
  const toast = useToast()
  const canEdit = access.canEdit
  const [columns, setColumns] = useState(sheet.columns)
  const [rows, setRows]       = useState<WorkSheetRow[]>(sheet.rows)
  const [dirty, setDirty]     = useState(false)
  const [isPending, start]    = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [wrapText, setWrapText] = useState(false)
  const [editingCol, setEditingCol] = useState<string | null>(null)
  const [editingColName, setEditingColName] = useState('')
  const [linkRowId, setLinkRowId] = useState<string | null>(null)
  const [linkTacticId, setLinkTacticId] = useState('')
  const [visibleRowCount, setVisibleRowCount] = useState(ROW_PAGE_SIZE)

  const isLargeSheet = rows.length > LARGE_SHEET_THRESHOLD
  const wrapAllowed  = !isLargeSheet
  const effectiveWrap = wrapText && wrapAllowed
  const displayRows  = isLargeSheet ? rows.slice(0, visibleRowCount) : rows

  useEffect(() => {
    setColumns(sheet.columns)
    setRows(sheet.rows)
    setDirty(false)
    setEditingCol(null)
    setVisibleRowCount(ROW_PAGE_SIZE)
  }, [sheet.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Wrap defaults off for performance; large sheets never use wrap.
  useEffect(() => {
    if (sheet.rows.length > LARGE_SHEET_THRESHOLD) {
      setWrapText(false)
      return
    }
    setWrapText(localStorage.getItem(WRAP_PREF_KEY) === '1')
  }, [sheet.id, sheet.rows.length])

  const toggleWrap = () => {
    if (!wrapAllowed) {
      toast.error(`Wrap is disabled for sheets with more than ${LARGE_SHEET_THRESHOLD} rows`)
      return
    }
    setWrapText(prev => {
      const next = !prev
      localStorage.setItem(WRAP_PREF_KEY, next ? '1' : '0')
      return next
    })
  }

  const widthsKey = `wsso:my-work:col-widths:${sheet.id}`
  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const colWidthsRef = useRef(colWidths)
  colWidthsRef.current = colWidths

  const heightsKey = `wsso:my-work:row-heights:${sheet.id}`
  const [rowHeights, setRowHeights] = useState<Record<string, number>>({})
  const rowHeightsRef = useRef(rowHeights)
  rowHeightsRef.current = rowHeights

  useEffect(() => {
    try {
      const raw = localStorage.getItem(widthsKey)
      if (raw) setColWidths(JSON.parse(raw))
    } catch { /* corrupt pref — ignore and use defaults */ }
  }, [widthsKey])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(heightsKey)
      if (raw) setRowHeights(JSON.parse(raw))
    } catch { /* corrupt pref — ignore and use defaults */ }
  }, [heightsKey])

  const startResize = (col: string, e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = colWidthsRef.current[col] ?? DEFAULT_COL_WIDTH
    const clamp = (x: number) => Math.max(MIN_COL_WIDTH, Math.min(MAX_COL_WIDTH, x))
    document.body.style.cursor = 'col-resize'

    const onMove = (ev: PointerEvent) => {
      const w = clamp(startW + ev.clientX - startX)
      setColWidths(prev => ({ ...prev, [col]: w }))
    }
    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      const next = { ...colWidthsRef.current, [col]: clamp(startW + ev.clientX - startX) }
      setColWidths(next)
      localStorage.setItem(widthsKey, JSON.stringify(next))
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  const startRowResize = useCallback((rowId: string, e: React.PointerEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const rowEl = (e.currentTarget as HTMLElement).closest('tr')
    const startH = rowHeightsRef.current[rowId]
      ?? rowEl?.getBoundingClientRect().height
      ?? DEFAULT_ROW_HEIGHT
    const clamp = (y: number) => Math.max(MIN_ROW_HEIGHT, Math.min(MAX_ROW_HEIGHT, y))
    document.body.style.cursor = 'row-resize'

    const onMove = (ev: PointerEvent) => {
      const h = clamp(startH + ev.clientY - startY)
      setRowHeights(prev => ({ ...prev, [rowId]: h }))
    }
    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.body.style.cursor = ''
      const next = { ...rowHeightsRef.current, [rowId]: clamp(startH + ev.clientY - startY) }
      setRowHeights(next)
      localStorage.setItem(heightsKey, JSON.stringify(next))
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }, [heightsKey])

  const markDirty = useCallback(() => setDirty(true), [])

  const updateCell = useCallback((rowId: string, col: string, value: string) => {
    setRows(prev => prev.map(r =>
      r.id === rowId ? { ...r, cells: { ...r.cells, [col]: value } } : r,
    ))
    markDirty()
  }, [markDirty])

  const addRow = () => {
    setRows(prev => [...prev, newRow(columns)])
    markDirty()
  }

  const removeRow = useCallback((rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId))
    setRowHeights(prev => {
      if (prev[rowId] === undefined) return prev
      const next = { ...prev }
      delete next[rowId]
      localStorage.setItem(heightsKey, JSON.stringify(next))
      return next
    })
    markDirty()
  }, [heightsKey, markDirty])

  const addColumn = () => {
    const name = `Column ${columns.length + 1}`
    setColumns(prev => [...prev, name])
    setRows(prev => prev.map(r => ({ ...r, cells: { ...r.cells, [name]: '' } })))
    markDirty()
  }

  const renameColumn = (oldName: string, rawNewName: string) => {
    const newName = rawNewName.trim()
    setEditingCol(null)
    if (!newName || newName === oldName) return
    if (columns.some(c => c === newName)) {
      toast.error('A column with that name already exists')
      return
    }
    setColumns(prev => prev.map(c => (c === oldName ? newName : c)))
    setRows(prev =>
      prev.map(r => {
        const cells = { ...r.cells }
        cells[newName] = cells[oldName] ?? ''
        delete cells[oldName]
        return { ...r, cells }
      }),
    )
    setColWidths(prev => {
      if (prev[oldName] === undefined) return prev
      const next = { ...prev, [newName]: prev[oldName] }
      delete next[oldName]
      localStorage.setItem(widthsKey, JSON.stringify(next))
      return next
    })
    markDirty()
  }

  const removeColumn = (colName: string) => {
    if (columns.length <= 1) {
      toast.error('Cannot delete the last column')
      return
    }
    setColumns(prev => prev.filter(c => c !== colName))
    setRows(prev =>
      prev.map(r => {
        const cells = { ...r.cells }
        delete cells[colName]
        return { ...r, cells }
      }),
    )
    setColWidths(prev => {
      if (prev[colName] === undefined) return prev
      const next = { ...prev }
      delete next[colName]
      localStorage.setItem(widthsKey, JSON.stringify(next))
      return next
    })
    if (editingCol === colName) setEditingCol(null)
    markDirty()
  }

  const startRenameColumn = (col: string) => {
    if (!canEdit) return
    setEditingCol(col)
    setEditingColName(col)
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

  const handleCreateWO = useCallback((rowId: string) => {
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
  }, [columns, dirty, onSheetChange, rows, sheet.id, start, toast])

  const openLinkDialog = useCallback((rowId: string) => {
    const row = rows.find(r => r.id === rowId)
    setLinkRowId(rowId)
    setLinkTacticId(row?.tactic_id ?? '')
  }, [rows])

  const confirmLinkWO = () => {
    if (!linkRowId) return
    const rowId = linkRowId
    start(async () => {
      try {
        if (dirty) await updateWorkSheet(sheet.id, { columns, rows })
        const updatedRows = await linkRowToWorkOrder(sheet.id, rowId, linkTacticId || null)
        setRows(updatedRows)
        setDirty(false)
        onSheetChange({ ...sheet, columns, rows: updatedRows })
        setLinkRowId(null)
        toast.success(linkTacticId ? 'Linked to work order' : 'Link removed')
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

  const workOrderById = useRef(new Map<string, WorkOrderOption>())
  workOrderById.current = new Map(workOrders.map(t => [t.id, t]))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">{sheet.name}</h3>
          {sheet.source_filename && (
            <p className="text-xs text-neutral-400">Imported from {sheet.source_filename}</p>
          )}
          {isLargeSheet && (
            <p className="mt-1 text-xs text-amber-600">
              Large sheet ({rows.length.toLocaleString()} rows) — showing {displayRows.length.toLocaleString()} at a time for speed.
            </p>
          )}
          {!access.isOwner && access.ownerName && (
            <p className="mt-0.5 text-xs text-primary-600">
              Shared by {access.ownerName}
              {!canEdit && ' · View only'}
              {canEdit && ' · You can edit'}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {access.isOwner && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShareOpen(true)}
              title="Share with manager or admin"
            >
              <Users className="h-3.5 w-3.5" />
              Share
              {(access.shareCount ?? 0) > 0 && (
                <span className="rounded-full bg-primary-100 px-1.5 text-xs text-primary-700">
                  {access.shareCount}
                </span>
              )}
            </Button>
          )}
          {canEdit && (
            <>
              <Button
                variant="secondary"
                size="sm"
                onClick={toggleWrap}
                disabled={!wrapAllowed}
                className={cn(
                  effectiveWrap && 'border-primary-300 bg-primary-50 text-primary-700 hover:bg-primary-100',
                  !wrapAllowed && 'opacity-50',
                )}
                title={
                  wrapAllowed
                    ? effectiveWrap ? 'Show each cell on a single line' : 'Wrap long text inside cells (like Excel)'
                    : `Disabled for sheets over ${LARGE_SHEET_THRESHOLD} rows`
                }
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
            </>
          )}
          {access.isOwner && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="w-10 border border-neutral-300 bg-neutral-100 px-2 py-1.5 text-center text-xs font-semibold text-neutral-400 select-none">
                #
              </th>
              {columns.map(col => (
                <th
                  key={col}
                  style={colStyle(colWidths, col)}
                  className={cn(
                    'relative border border-neutral-300 bg-neutral-100 px-1 py-1.5 text-left text-xs font-semibold text-neutral-600',
                    !colWidths[col] && 'min-w-[140px]',
                  )}
                >
                  <div className="group flex min-w-0 items-center gap-0.5 pr-2">
                    {editingCol === col ? (
                      <input
                        autoFocus
                        className="min-w-0 flex-1 rounded border border-primary-400 bg-white px-1.5 py-0.5 text-xs font-semibold text-neutral-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        value={editingColName}
                        onChange={e => setEditingColName(e.target.value)}
                        onBlur={() => renameColumn(col, editingColName)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') e.currentTarget.blur()
                          if (e.key === 'Escape') {
                            setEditingCol(null)
                            setEditingColName(col)
                          }
                        }}
                        onClick={e => e.stopPropagation()}
                      />
                    ) : (
                      <>
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate px-1.5',
                            canEdit && 'cursor-text rounded hover:bg-neutral-200/80',
                          )}
                          onDoubleClick={() => startRenameColumn(col)}
                          title={canEdit ? 'Double-click to rename column' : col}
                        >
                          {col}
                        </span>
                        {canEdit && columns.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeColumn(col)}
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-neutral-400 opacity-0 transition-opacity hover:bg-danger-100 hover:text-danger-600 group-hover:opacity-100"
                            title="Delete column"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div
                    onPointerDown={e => startResize(col, e)}
                    className="absolute -right-[3px] top-0 z-10 h-full w-1.5 cursor-col-resize touch-none select-none hover:bg-primary-400/70 active:bg-primary-500"
                    title="Drag to resize column"
                  />
                </th>
              ))}
              <th className="border border-neutral-300 bg-neutral-100 px-3 py-1.5 text-left text-xs font-semibold text-neutral-600">
                Work order
              </th>
              <th className="w-24 border border-neutral-300 bg-neutral-100 px-3 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 3} className="border border-neutral-300 px-5 py-8 text-center text-neutral-400">
                  No rows yet — click <strong>Add Row</strong> or edit cells after import.
                </td>
              </tr>
            ) : displayRows.map((row, rowIdx) => (
              <GridRow
                key={row.id}
                row={row}
                rowIdx={rowIdx}
                columns={columns}
                colWidths={colWidths}
                rowHeights={rowHeights}
                wrapText={effectiveWrap}
                canEdit={canEdit}
                isPending={isPending}
                linked={row.tactic_id ? workOrderById.current.get(row.tactic_id) : undefined}
                onUpdateCell={updateCell}
                onRemoveRow={removeRow}
                onLinkClick={openLinkDialog}
                onCreateWO={handleCreateWO}
                onResizeRow={startRowResize}
              />
            ))}
          </tbody>
        </table>
      </div>

      {isLargeSheet && visibleRowCount < rows.length && (
        <div className="flex justify-center">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setVisibleRowCount(c => Math.min(c + ROW_PAGE_SIZE, rows.length))}
          >
            Load more rows ({displayRows.length.toLocaleString()} of {rows.length.toLocaleString()} shown)
          </Button>
        </div>
      )}

      <p className="text-xs text-neutral-400">
        <Link2 className="mr-1 inline h-3 w-3" />
        Double-click a column header to rename · drag column/row edges to resize · hover row # or column header to delete · use <strong>Link…</strong> or <strong>Create WO</strong> per row.
      </p>

      <Dialog
        open={!!linkRowId}
        onClose={() => setLinkRowId(null)}
        title="Link row to work order"
        size="md"
      >
        <Select
          label="Work order"
          value={linkTacticId}
          onChange={e => setLinkTacticId(e.target.value)}
        >
          <option value="">— No link —</option>
          {workOrders.map(t => (
            <option key={t.id} value={t.id}>{t.code} — {t.title}</option>
          ))}
        </Select>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setLinkRowId(null)}>Cancel</Button>
          <Button loading={isPending} onClick={confirmLinkWO}>Save link</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete sheet?">
        <p className="text-sm text-neutral-600">
          Delete <strong>{sheet.name}</strong>? This cannot be undone.
        </p>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button variant="destructive" loading={isPending} onClick={confirmDelete}>Delete</Button>
        </DialogFooter>
      </Dialog>

      {access.isOwner && (
        <WorkSheetShareDialog
          sheetId={sheet.id}
          sheetName={sheet.name}
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          onChanged={onShareChange}
        />
      )}
    </div>
  )
}
