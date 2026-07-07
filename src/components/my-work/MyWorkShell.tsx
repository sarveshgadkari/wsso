'use client'

import { useState, useRef, useTransition, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  Plus, Upload, FileUp, Table2, FileSpreadsheet, FileText, LayoutTemplate, Users,
  FolderPlus, Folder, ChevronDown, ChevronRight, Pencil, Trash2, Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/lib/store/toast'
import {
  uploadWorkSheetExcel,
  uploadWorkSheetDocument,
  createBlankWorkSheet,
  createDocumentWorkSheet,
  createWorkSheetFolder,
  renameWorkSheetFolder,
  deleteWorkSheetFolder,
  moveWorkSheetToFolder,
  renameWorkSheet,
  getMyWorkSheet,
} from '@/lib/actions/my-work'
import { WorkSheetFolderShareDialog } from './WorkSheetFolderShareDialog'
import type {
  WorkSheetWithAccess,
  WorkSheetListItem,
  WorkOrderOption,
  WorkSheetFolder,
  WorkSheet,
} from '@/lib/my-work/types'
import { cn } from '@/lib/utils'

const WorkSheetGrid = dynamic(
  () => import('./WorkSheetGrid').then(m => ({ default: m.WorkSheetGrid })),
  { loading: () => <SheetLoading label="spreadsheet" /> },
)

const WorkDocumentEditor = dynamic(
  () => import('./WorkDocumentEditor').then(m => ({ default: m.WorkDocumentEditor })),
  { loading: () => <SheetLoading label="document" />, ssr: false },
)

function SheetLoading({ label }: { label: string }) {
  return (
    <div className="card flex items-center justify-center gap-2 px-6 py-16 text-sm text-neutral-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      Loading {label}…
    </div>
  )
}

function toListItem(sheet: WorkSheetWithAccess): WorkSheetListItem {
  return {
    id:              sheet.id,
    employee_id:     sheet.employee_id,
    name:            sheet.name,
    sheet_type:      sheet.sheet_type,
    source_filename: sheet.source_filename,
    folder_id:       sheet.folder_id,
    created_at:      sheet.created_at,
    updated_at:      sheet.updated_at,
    access:          sheet.access,
  }
}

interface Props {
  initialSheets:  WorkSheetListItem[]
  initialFolders: WorkSheetFolder[]
  workOrders:     WorkOrderOption[]
}

function SheetIcon({ sheet }: { sheet: WorkSheetListItem }) {
  if (sheet.sheet_type === 'document') {
    return <FileText className="h-4 w-4 shrink-0 opacity-60" />
  }
  return <FileSpreadsheet className="h-4 w-4 shrink-0 opacity-60" />
}

function SheetListItem({
  sheet,
  selected,
  onSelect,
  folders,
  onMove,
  onRename,
}: {
  sheet: WorkSheetListItem
  selected: boolean
  onSelect: () => void
  folders?: WorkSheetFolder[]
  onMove?: (folderId: string | null) => void
  onRename?: () => void
}) {
  return (
    <div
      className={cn(
        'group flex w-full items-center gap-1 rounded-md px-2 py-2 text-left text-sm transition-colors',
        selected
          ? 'bg-primary-50 font-medium text-primary-800'
          : 'text-neutral-700 hover:bg-neutral-50',
      )}
    >
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2">
        <SheetIcon sheet={sheet} />
        <span className="min-w-0 flex-1 truncate">{sheet.name}</span>
      </button>
      {!sheet.access.isOwner && (
        <span
          title={sheet.access.viaFolder ? `Shared via folder "${sheet.access.viaFolder}"` : 'Shared with you'}
          className="flex shrink-0 items-center gap-1"
        >
          {sheet.access.viaFolder && <Folder className="h-3 w-3 text-primary-400" />}
          <Users className="h-3 w-3 text-primary-400" />
        </span>
      )}
      {sheet.access.isOwner && (sheet.access.shareCount ?? 0) > 0 && (
        <span className="shrink-0 rounded-full bg-primary-100 px-1.5 text-[10px] font-medium text-primary-700">
          {sheet.access.shareCount}
        </span>
      )}
      {sheet.access.isOwner && onRename && (
        <button
          type="button"
          title="Rename"
          onClick={e => { e.stopPropagation(); onRename() }}
          className="hidden shrink-0 rounded p-0.5 text-neutral-400 hover:bg-neutral-100 hover:text-primary-600 group-hover:block"
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
      {folders && onMove && (
        <select
          value={sheet.folder_id ?? ''}
          onChange={e => onMove(e.target.value || null)}
          onClick={e => e.stopPropagation()}
          title="Move to folder"
          className="hidden shrink-0 rounded border border-neutral-200 bg-white px-1 py-0.5 text-[11px] text-neutral-500 group-hover:block"
        >
          <option value="">No folder</option>
          {folders.map(f => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}

export function MyWorkShell({ initialSheets, initialFolders, workOrders }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [sheets, setSheets]         = useState(initialSheets)
  const [sheetCache, setSheetCache] = useState<Record<string, WorkSheetWithAccess>>({})
  const [loadingSheetId, setLoadingSheetId] = useState<string | null>(null)
  const [folders, setFolders]       = useState(initialFolders)
  const [selectedId, setSelectedId] = useState(initialSheets[0]?.id ?? '')
  const sheetCacheRef = useRef(sheetCache)
  sheetCacheRef.current = sheetCache
  const [uploadOpen, setUploadOpen]   = useState(false)
  const [docUploadOpen, setDocUploadOpen] = useState(false)
  const [gridOpen, setGridOpen]       = useState(false)
  const [docOpen, setDocOpen]         = useState(false)
  const [folderOpen, setFolderOpen]   = useState(false)
  const [renamingFolder, setRenamingFolder] = useState<WorkSheetFolder | null>(null)
  const [folderName, setFolderName]   = useState('')
  const [sheetRenameOpen, setSheetRenameOpen] = useState(false)
  const [renamingSheet, setRenamingSheet] = useState<WorkSheetListItem | null>(null)
  const [renameSheetName, setRenameSheetName] = useState('')
  const [collapsed, setCollapsed]     = useState<Set<string>>(new Set())
  const [sheetName, setSheetName]     = useState('')
  const [file, setFile]               = useState<File | null>(null)
  const [docFile, setDocFile]         = useState<File | null>(null)
  const [targetFolderId, setTargetFolderId] = useState<string | null>(null)
  const [menuFolderId, setMenuFolderId]     = useState<string | null>(null)
  const [shareFolder, setShareFolder]       = useState<WorkSheetFolder | null>(null)
  const [isPending, start]            = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)
  const docFileRef = useRef<HTMLInputElement>(null)

  const selectedSummary = sheets.find(s => s.id === selectedId)
  const selectedFull    = selectedId ? sheetCache[selectedId] : undefined

  const loadSheet = useCallback(async (sheetId: string) => {
    if (sheetCacheRef.current[sheetId]) return
    setLoadingSheetId(sheetId)
    try {
      const sheet = await getMyWorkSheet(sheetId)
      setSheetCache(prev => ({ ...prev, [sheetId]: sheet }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load sheet')
    } finally {
      setLoadingSheetId(prev => (prev === sheetId ? null : prev))
    }
  }, [toast])

  useEffect(() => {
    if (selectedId) void loadSheet(selectedId)
  }, [selectedId, loadSheet])

  const upsertSheet = useCallback((full: WorkSheetWithAccess) => {
    setSheetCache(prev => ({ ...prev, [full.id]: full }))
    setSheets(prev => {
      const item = toListItem(full)
      const idx  = prev.findIndex(s => s.id === full.id)
      if (idx === -1) return [item, ...prev]
      const next = [...prev]
      next[idx] = { ...item, access: full.access }
      return next
    })
  }, [])

  const ownedSheets  = sheets.filter(s => s.access.isOwner)
  const sharedSheets = sheets.filter(s => !s.access.isOwner)
  const unfiledSheets = ownedSheets.filter(s => !s.folder_id)

  const toggleFolder = (id: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const openRenameSheet = (sheet: WorkSheetListItem) => {
    setRenamingSheet(sheet)
    setRenameSheetName(sheet.name)
    setSheetRenameOpen(true)
  }

  const handleSaveSheetRename = () => {
    const trimmed = renameSheetName.trim()
    if (!trimmed || !renamingSheet) return
    start(async () => {
      try {
        const updated = await renameWorkSheet(renamingSheet.id, trimmed)
        setSheets(prev => prev.map(s =>
          s.id === updated.id ? { ...s, name: updated.name, updated_at: updated.updated_at } : s,
        ))
        setSheetCache(prev => {
          const cached = prev[updated.id]
          if (!cached) return prev
          return { ...prev, [updated.id]: { ...cached, name: updated.name, updated_at: updated.updated_at } }
        })
        setSheetRenameOpen(false)
        setRenamingSheet(null)
        toast.success('File renamed')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Rename failed')
      }
    })
  }

  const handleSaveFolder = () => {
    const trimmed = folderName.trim()
    if (!trimmed) return
    start(async () => {
      try {
        if (renamingFolder) {
          const updated = await renameWorkSheetFolder(renamingFolder.id, trimmed)
          setFolders(prev => prev.map(f => f.id === updated.id ? updated : f))
          toast.success('Folder renamed')
        } else {
          const created = await createWorkSheetFolder(trimmed)
          setFolders(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
          toast.success('Folder created')
        }
        setFolderOpen(false)
        setRenamingFolder(null)
        setFolderName('')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Folder save failed')
      }
    })
  }

  const handleDeleteFolder = (folder: WorkSheetFolder) => {
    if (!confirm(`Delete folder "${folder.name}"? Sheets inside will move to "No folder".`)) return
    start(async () => {
      try {
        await deleteWorkSheetFolder(folder.id)
        setFolders(prev => prev.filter(f => f.id !== folder.id))
        setSheets(prev => prev.map(s => s.folder_id === folder.id ? { ...s, folder_id: null } : s))
        toast.success('Folder deleted')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Delete failed')
      }
    })
  }

  const handleMoveSheet = (sheetId: string, folderId: string | null) => {
    setSheets(prev => prev.map(s => s.id === sheetId ? { ...s, folder_id: folderId } : s))
    start(async () => {
      try {
        await moveWorkSheetToFolder(sheetId, folderId)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Move failed')
      }
    })
  }

  const refreshShares = () => {
    router.refresh()
    start(async () => {
      try {
        const { listMyWorkSheets } = await import('@/lib/actions/my-work')
        const updated = await listMyWorkSheets()
        setSheets(updated)
      } catch { /* page refresh will reconcile */ }
    })
  }

  const onSheetDelete = (id: string) => {
    setSheets(prev => {
      const next = prev.filter(s => s.id !== id)
      if (selectedId === id) setSelectedId(next[0]?.id ?? '')
      return next
    })
    setSheetCache(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleUpload = () => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    if (sheetName.trim()) fd.append('name', sheetName.trim())
    if (targetFolderId) fd.append('folderId', targetFolderId)

    start(async () => {
      try {
        const sheet = await uploadWorkSheetExcel(fd)
        const withAccess: WorkSheetWithAccess = {
          ...sheet,
          access: { isOwner: true, canEdit: true, shareCount: 0 },
        }
        upsertSheet(withAccess)
        setSelectedId(withAccess.id)
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

  const handleUploadDocument = () => {
    if (!docFile) return
    const fd = new FormData()
    fd.append('file', docFile)
    if (sheetName.trim()) fd.append('name', sheetName.trim())
    if (targetFolderId) fd.append('folderId', targetFolderId)

    start(async () => {
      try {
        const sheet = await uploadWorkSheetDocument(fd)
        const withAccess: WorkSheetWithAccess = {
          ...sheet,
          access: { isOwner: true, canEdit: true, shareCount: 0 },
        }
        upsertSheet(withAccess)
        setSelectedId(withAccess.id)
        setDocUploadOpen(false)
        setDocFile(null)
        setSheetName('')
        if (docFileRef.current) docFileRef.current.value = ''
        toast.success(`Imported "${sheet.name}"`)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Upload failed')
      }
    })
  }

  const handleCreateGrid = () => {
    start(async () => {
      try {
        const sheet = await createBlankWorkSheet(sheetName.trim() || 'My spreadsheet', targetFolderId)
        const withAccess: WorkSheetWithAccess = {
          ...sheet,
          access: { isOwner: true, canEdit: true, shareCount: 0 },
        }
        upsertSheet(withAccess)
        setSelectedId(withAccess.id)
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
        const sheet = await createDocumentWorkSheet(sheetName.trim() || 'Untitled page', targetFolderId)
        const withAccess: WorkSheetWithAccess = {
          ...sheet,
          access: { isOwner: true, canEdit: true, shareCount: 0 },
        }
        upsertSheet(withAccess)
        setSelectedId(withAccess.id)
        setDocOpen(false)
        setSheetName('')
        toast.success('Page created')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Create failed')
      }
    })
  }

  const openCreate = (folderId: string | null, type: 'upload' | 'docUpload' | 'doc' | 'grid') => {
    setTargetFolderId(folderId)
    setMenuFolderId(null)
    setSheetName('')
    setFile(null)
    setDocFile(null)
    if (type === 'upload')    setUploadOpen(true)
    if (type === 'docUpload') setDocUploadOpen(true)
    if (type === 'doc')       setDocOpen(true)
    if (type === 'grid')      setGridOpen(true)
  }

  const targetFolderName = folders.find(f => f.id === targetFolderId)?.name ?? null

  const handleSheetChange = useCallback((updated: WorkSheet) => {
    setSheetCache(prev => {
      const existing = prev[updated.id]
      if (!existing) return prev
      return { ...prev, [updated.id]: { ...updated, access: existing.access } }
    })
    setSheets(prev => prev.map(s =>
      s.id === updated.id
        ? { ...s, name: updated.name, updated_at: updated.updated_at, sheet_type: updated.sheet_type }
        : s,
    ))
  }, [])

  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-56">
        <div className="card p-3">
          <div className="mb-2 flex items-center justify-between px-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
              My work
            </p>
            <button
              type="button"
              title="New folder"
              onClick={() => { setRenamingFolder(null); setFolderName(''); setFolderOpen(true) }}
              className="text-neutral-400 hover:text-primary-600"
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          </div>

          {folders.map(folder => {
            const folderSheets = ownedSheets.filter(s => s.folder_id === folder.id)
            const isCollapsed  = collapsed.has(folder.id)
            return (
              <div key={folder.id} className="mb-1">
                <div className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-neutral-50">
                  <button
                    type="button"
                    onClick={() => toggleFolder(folder.id)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-sm font-medium text-neutral-700"
                  >
                    {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
                    <Folder className="h-3.5 w-3.5 shrink-0 opacity-60" />
                    <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                    <span className="shrink-0 text-xs font-normal text-neutral-400">{folderSheets.length}</span>
                  </button>
                  <div className="hidden shrink-0 items-center gap-1 group-hover:flex">
                    <button
                      type="button"
                      title="Add to this folder"
                      onClick={() => setMenuFolderId(prev => prev === folder.id ? null : folder.id)}
                      className="text-neutral-400 hover:text-primary-600"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Share folder"
                      onClick={() => setShareFolder(folder)}
                      className="text-neutral-400 hover:text-primary-600"
                    >
                      <Users className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Rename folder"
                      onClick={() => { setRenamingFolder(folder); setFolderName(folder.name); setFolderOpen(true) }}
                      className="text-neutral-400 hover:text-primary-600"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      title="Delete folder"
                      onClick={() => handleDeleteFolder(folder)}
                      className="text-neutral-400 hover:text-danger-600"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {menuFolderId === folder.id && (
                  <div className="ml-4 mb-1 flex flex-col gap-0.5 rounded-md border border-neutral-200 bg-neutral-50 p-1">
                    <button
                      type="button"
                      onClick={() => openCreate(folder.id, 'upload')}
                      className="flex items-center gap-2 rounded px-2 py-1 text-left text-xs text-neutral-600 hover:bg-white"
                    >
                      <Upload className="h-3 w-3" /> Upload Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreate(folder.id, 'docUpload')}
                      className="flex items-center gap-2 rounded px-2 py-1 text-left text-xs text-neutral-600 hover:bg-white"
                    >
                      <FileUp className="h-3 w-3" /> Upload Document
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreate(folder.id, 'doc')}
                      className="flex items-center gap-2 rounded px-2 py-1 text-left text-xs text-neutral-600 hover:bg-white"
                    >
                      <LayoutTemplate className="h-3 w-3" /> New Notion page
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreate(folder.id, 'grid')}
                      className="flex items-center gap-2 rounded px-2 py-1 text-left text-xs text-neutral-600 hover:bg-white"
                    >
                      <Plus className="h-3 w-3" /> New spreadsheet
                    </button>
                  </div>
                )}
                {!isCollapsed && (
                  <ul className="flex flex-col gap-0.5 pl-4">
                    {folderSheets.map(s => (
                      <li key={s.id}>
                        <SheetListItem
                          sheet={s}
                          selected={selectedSummary?.id === s.id}
                          onSelect={() => setSelectedId(s.id)}
                          folders={folders}
                          onMove={folderId => handleMoveSheet(s.id, folderId)}
                          onRename={() => openRenameSheet(s)}
                        />
                      </li>
                    ))}
                    {folderSheets.length === 0 && (
                      <li className="px-2 py-1 text-xs text-neutral-400">Empty</li>
                    )}
                  </ul>
                )}
              </div>
            )
          })}

          <ul className="flex flex-col gap-0.5">
            {unfiledSheets.map(s => (
              <li key={s.id}>
                <SheetListItem
                  sheet={s}
                  selected={selectedSummary?.id === s.id}
                  onSelect={() => setSelectedId(s.id)}
                  folders={folders}
                  onMove={folderId => handleMoveSheet(s.id, folderId)}
                  onRename={() => openRenameSheet(s)}
                />
              </li>
            ))}
          </ul>
          {ownedSheets.length === 0 && sharedSheets.length === 0 && (
            <p className="px-2 py-3 text-xs text-neutral-400">Nothing here yet</p>
          )}
          {sharedSheets.length > 0 && (
            <>
              <p className="mb-2 mt-4 px-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Shared with me
              </p>
              <ul className="flex flex-col gap-0.5">
                {sharedSheets.map(s => (
                  <li key={s.id}>
                    <SheetListItem
                      sheet={s}
                      selected={selectedSummary?.id === s.id}
                      onSelect={() => setSelectedId(s.id)}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-3 flex flex-col gap-2 border-t border-neutral-100 pt-3">
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={() => openCreate(null, 'upload')}
            >
              <Upload className="h-3.5 w-3.5" /> Upload Excel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={() => openCreate(null, 'docUpload')}
            >
              <FileUp className="h-3.5 w-3.5" /> Upload Document
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={() => openCreate(null, 'doc')}
            >
              <LayoutTemplate className="h-3.5 w-3.5" /> New Notion page
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              onClick={() => openCreate(null, 'grid')}
            >
              <Plus className="h-3.5 w-3.5" /> New spreadsheet
            </Button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {selectedSummary && loadingSheetId === selectedId && !selectedFull ? (
          <SheetLoading label={selectedSummary.sheet_type === 'document' ? 'document' : 'spreadsheet'} />
        ) : selectedFull ? (
          selectedFull.sheet_type === 'document' ? (
            <WorkDocumentEditor
              key={selectedFull.id}
              sheet={selectedFull}
              access={selectedFull.access}
              onSheetChange={handleSheetChange}
              onSheetDelete={onSheetDelete}
              onShareChange={refreshShares}
            />
          ) : (
            <WorkSheetGrid
              key={selectedFull.id}
              sheet={selectedFull}
              access={selectedFull.access}
              workOrders={workOrders}
              onSheetChange={handleSheetChange}
              onSheetDelete={onSheetDelete}
              onShareChange={refreshShares}
            />
          )
        ) : selectedSummary ? (
          <SheetLoading label={selectedSummary.sheet_type === 'document' ? 'document' : 'spreadsheet'} />
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
              <Button onClick={() => openCreate(null, 'upload')}>
                <Upload className="h-4 w-4" /> Upload Excel
              </Button>
              <Button variant="secondary" onClick={() => openCreate(null, 'docUpload')}>
                <FileUp className="h-4 w-4" /> Upload Document
              </Button>
              <Button variant="secondary" onClick={() => openCreate(null, 'doc')}>
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
          {targetFolderName && (
            <p className="text-xs text-neutral-400">Creating in folder <strong>{targetFolderName}</strong></p>
          )}
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

      <Dialog open={docUploadOpen} onClose={() => setDocUploadOpen(false)} title="Upload Document">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-600">
            Import a Word document (.docx) or text file (.txt). It opens as an editable Notion-style
            page so you can keep working on it right here in WSSO.
          </p>
          {targetFolderName && (
            <p className="text-xs text-neutral-400">Creating in folder <strong>{targetFolderName}</strong></p>
          )}
          <Input
            label="Name (optional)"
            placeholder="Onboarding guide"
            value={sheetName}
            onChange={e => setSheetName(e.target.value)}
          />
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-700">Document file</label>
            <input
              ref={docFileRef}
              type="file"
              accept=".docx,.txt"
              className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-700"
              onChange={e => setDocFile(e.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setDocUploadOpen(false)}>Cancel</Button>
          <Button loading={isPending} disabled={!docFile} onClick={handleUploadDocument}>Upload</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={docOpen} onClose={() => setDocOpen(false)} title="New Notion-style page">
        <p className="mb-3 text-sm text-neutral-600">
          Free-form page with headings, bullets, to-dos — like Notion. Great for new work and notes.
        </p>
        {targetFolderName && (
          <p className="mb-3 text-xs text-neutral-400">Creating in folder <strong>{targetFolderName}</strong></p>
        )}
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
        {targetFolderName && (
          <p className="mb-3 text-xs text-neutral-400">Creating in folder <strong>{targetFolderName}</strong></p>
        )}
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

      <Dialog
        open={sheetRenameOpen}
        onClose={() => { setSheetRenameOpen(false); setRenamingSheet(null) }}
        title="Rename file"
      >
        <Input
          label="File name"
          placeholder="e.g. Funding matrix"
          value={renameSheetName}
          onChange={e => setRenameSheetName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSaveSheetRename() }}
        />
        <DialogFooter>
          <Button variant="secondary" onClick={() => { setSheetRenameOpen(false); setRenamingSheet(null) }}>
            Cancel
          </Button>
          <Button loading={isPending} disabled={!renameSheetName.trim()} onClick={handleSaveSheetRename}>
            Save
          </Button>
        </DialogFooter>
      </Dialog>

      <Dialog
        open={folderOpen}
        onClose={() => { setFolderOpen(false); setRenamingFolder(null) }}
        title={renamingFolder ? 'Rename folder' : 'New folder'}
      >
        <Input
          label="Folder name"
          placeholder="e.g. Client projects"
          value={folderName}
          onChange={e => setFolderName(e.target.value)}
        />
        <DialogFooter>
          <Button variant="secondary" onClick={() => { setFolderOpen(false); setRenamingFolder(null) }}>
            Cancel
          </Button>
          <Button loading={isPending} disabled={!folderName.trim()} onClick={handleSaveFolder}>
            {renamingFolder ? 'Save' : 'Create folder'}
          </Button>
        </DialogFooter>
      </Dialog>

      {shareFolder && (
        <WorkSheetFolderShareDialog
          folderId={shareFolder.id}
          folderName={shareFolder.name}
          open={!!shareFolder}
          onClose={() => setShareFolder(null)}
          onChanged={refreshShares}
        />
      )}
    </div>
  )
}
