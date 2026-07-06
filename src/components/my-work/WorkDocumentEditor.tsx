'use client'

import { useState, useRef, useTransition, KeyboardEvent, useMemo } from 'react'
import {
  Plus, Trash2, Save, GripVertical, Type, List, ListOrdered,
  CheckSquare, Minus, Heading1, Heading2, Heading3,
  ClipboardPlus, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { useToast } from '@/lib/store/toast'
import {
  updateWorkSheet,
  deleteWorkSheet,
  createPersonalWorkOrder,
} from '@/lib/actions/my-work'
import type { WorkSheet, DocBlock, DocBlockType, WorkSheetAccess } from '@/lib/my-work/types'
import { WorkSheetShareDialog } from './WorkSheetShareDialog'
import { cn } from '@/lib/utils'

interface Props {
  sheet:         WorkSheet
  access:        WorkSheetAccess
  onSheetChange: (sheet: WorkSheet) => void
  onSheetDelete: (id: string) => void
  onShareChange: () => void
}

function newBlock(type: DocBlockType = 'paragraph'): DocBlock {
  return { id: crypto.randomUUID(), type, text: '', checked: type === 'todo' ? false : undefined }
}

const BLOCK_STYLES: Record<DocBlockType, string> = {
  heading1:  'text-2xl font-bold text-neutral-900',
  heading2:  'text-xl font-semibold text-neutral-900',
  heading3:  'text-lg font-medium text-neutral-800',
  paragraph: 'text-base text-neutral-700',
  bullet:    'text-base text-neutral-700',
  numbered:  'text-base text-neutral-700',
  todo:      'text-base text-neutral-700',
  divider:   '',
}

const TYPE_OPTIONS: { type: DocBlockType; label: string; icon: typeof Type }[] = [
  { type: 'paragraph', label: 'Text',     icon: Type },
  { type: 'heading1',  label: 'Heading 1', icon: Heading1 },
  { type: 'heading2',  label: 'Heading 2', icon: Heading2 },
  { type: 'heading3',  label: 'Heading 3', icon: Heading3 },
  { type: 'bullet',    label: 'Bullet',   icon: List },
  { type: 'numbered',  label: 'Numbered', icon: ListOrdered },
  { type: 'todo',      label: 'To-do',    icon: CheckSquare },
  { type: 'divider',   label: 'Divider',  icon: Minus },
]

export function WorkDocumentEditor({ sheet, access, onSheetChange, onSheetDelete, onShareChange }: Props) {
  const toast = useToast()
  const canEdit = access.canEdit
  const [blocks, setBlocks]     = useState<DocBlock[]>(
    sheet.blocks.length ? sheet.blocks : [newBlock('heading1'), newBlock('paragraph')],
  )
  const [dirty, setDirty]       = useState(false)
  const [isPending, start]      = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [menuBlockId, setMenuBlockId] = useState<string | null>(null)
  const inputRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})

  const markDirty = () => setDirty(true)

  const updateBlock = (id: string, patch: Partial<DocBlock>) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, ...patch } : b))
    markDirty()
  }

  const insertAfter = (afterId: string, type: DocBlockType = 'paragraph') => {
    const idx = blocks.findIndex(b => b.id === afterId)
    const nb  = newBlock(type)
    setBlocks(prev => [...prev.slice(0, idx + 1), nb, ...prev.slice(idx + 1)])
    markDirty()
    setTimeout(() => inputRefs.current[nb.id]?.focus(), 0)
    return nb.id
  }

  const removeBlock = (id: string) => {
    if (blocks.length <= 1) return
    const idx = blocks.findIndex(b => b.id === id)
    setBlocks(prev => prev.filter(b => b.id !== id))
    markDirty()
    const neighbor = blocks[idx - 1] ?? blocks[idx + 1]
    if (neighbor) setTimeout(() => inputRefs.current[neighbor.id]?.focus(), 0)
  }

  const setBlockType = (id: string, type: DocBlockType) => {
    updateBlock(id, {
      type,
      checked: type === 'todo' ? false : undefined,
      text:    type === 'divider' ? '' : blocks.find(b => b.id === id)?.text ?? '',
    })
    setMenuBlockId(null)
  }

  const handleKeyDown = (id: string, e: KeyboardEvent<HTMLTextAreaElement>) => {
    const block = blocks.find(b => b.id === id)
    if (!block || block.type === 'divider') return

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      insertAfter(id, block.type === 'bullet' || block.type === 'numbered' || block.type === 'todo'
        ? block.type
        : 'paragraph',
      )
    }

    if (e.key === 'Backspace' && block.text === '') {
      e.preventDefault()
      removeBlock(id)
    }
  }

  const save = () => {
    start(async () => {
      try {
        const updated = await updateWorkSheet(sheet.id, { blocks })
        onSheetChange(updated)
        setDirty(false)
        toast.success('Page saved')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  const createWOFromPage = () => {
    const titleBlock = blocks.find(b =>
      ['heading1', 'heading2', 'heading3'].includes(b.type) && b.text.trim(),
    )
    const title = titleBlock?.text.trim()
      ?? blocks.find(b => b.text.trim())?.text.trim()
      ?? sheet.name

    const body = blocks
      .filter(b => b.type !== 'divider' && b.text.trim())
      .map(b => {
        const prefix =
          b.type === 'bullet' ? '• ' :
          b.type === 'numbered' ? '- ' :
          b.type === 'todo' ? `[${b.checked ? 'x' : ' '}] ` : ''
        return prefix + b.text.trim()
      })
      .join('\n')

    start(async () => {
      try {
        if (dirty) {
          const updated = await updateWorkSheet(sheet.id, { blocks })
          onSheetChange(updated)
          setDirty(false)
        }
        const tactic = await createPersonalWorkOrder(title, body || null)
        toast.success(`Work order ${tactic.code} created from this page`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed')
      }
    })
  }

  const confirmDelete = () => {
    start(async () => {
      try {
        await deleteWorkSheet(sheet.id)
        onSheetDelete(sheet.id)
        setDeleteOpen(false)
        toast.success('Page deleted')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Delete failed')
      }
    })
  }

  const numberedMap = useMemo(() => {
    const map = new Map<string, number>()
    let n = 0
    blocks.forEach(b => {
      if (b.type === 'numbered') {
        n += 1
        map.set(b.id, n)
      } else {
        n = 0
      }
    })
    return map
  }, [blocks])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">{sheet.name}</h3>
          <p className="text-xs text-neutral-400">Notion-style page — headings, lists, to-dos</p>
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
            <Button variant="secondary" size="sm" onClick={() => setShareOpen(true)}>
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
              <Button variant="secondary" size="sm" onClick={() => {
                const nb = newBlock('paragraph')
                setBlocks(prev => [...prev, nb])
                markDirty()
              }}>
                <Plus className="h-3.5 w-3.5" /> Block
              </Button>
              <Button variant="secondary" size="sm" onClick={createWOFromPage} disabled={isPending}>
                <ClipboardPlus className="h-3.5 w-3.5" /> Create work order
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

      <div className="card min-h-[420px] px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-3xl space-y-1">
          {blocks.map(block => {
            if (block.type === 'divider') {
              return (
                <div key={block.id} className="group flex items-center gap-2 py-3">
                  <button type="button" className="opacity-0 group-hover:opacity-40" onClick={() => removeBlock(block.id)}>
                    <GripVertical className="h-4 w-4" />
                  </button>
                  <hr className="flex-1 border-neutral-200" />
                </div>
              )
            }

            return (
              <div key={block.id} className="group relative flex items-start gap-2 rounded-md py-0.5 hover:bg-neutral-50/80">
                <button
                  type="button"
                  className="mt-2 shrink-0 opacity-0 transition-opacity group-hover:opacity-40"
                  onClick={() => canEdit && setMenuBlockId(menuBlockId === block.id ? null : block.id)}
                  title="Change block type"
                  disabled={!canEdit}
                >
                  <GripVertical className="h-4 w-4 text-neutral-400" />
                </button>

                {block.type === 'bullet' && (
                  <span className="mt-2.5 w-4 shrink-0 text-neutral-400">•</span>
                )}
                {block.type === 'numbered' && (
                  <span className="mt-2.5 w-5 shrink-0 text-sm text-neutral-400">
                    {numberedMap.get(block.id)}.
                  </span>
                )}
                {block.type === 'todo' && (
                  <input
                    type="checkbox"
                    className="mt-3 h-4 w-4 shrink-0 rounded border-neutral-300"
                    checked={!!block.checked}
                    disabled={!canEdit}
                    onChange={e => updateBlock(block.id, { checked: e.target.checked })}
                  />
                )}

                <textarea
                  ref={el => { inputRefs.current[block.id] = el }}
                  rows={1}
                  readOnly={!canEdit}
                  value={block.text}
                  placeholder={
                    block.type === 'heading1' ? 'Untitled' :
                    block.type === 'todo' ? 'To-do' :
                    'Type something…'
                  }
                  className={cn(
                    'min-h-[1.75rem] flex-1 resize-none overflow-hidden border-0 bg-transparent py-1 leading-relaxed placeholder:text-neutral-300 focus:outline-none focus:ring-0',
                    BLOCK_STYLES[block.type],
                    block.checked && block.type === 'todo' && 'text-neutral-400 line-through',
                  )}
                  onChange={e => {
                    updateBlock(block.id, { text: e.target.value })
                    e.target.style.height = 'auto'
                    e.target.style.height = `${e.target.scrollHeight}px`
                  }}
                  onKeyDown={e => handleKeyDown(block.id, e)}
                  onFocus={e => {
                    e.target.style.height = 'auto'
                    e.target.style.height = `${e.target.scrollHeight}px`
                  }}
                />

                {menuBlockId === block.id && (
                  <div className="absolute left-8 top-full z-20 mt-1 flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
                    {TYPE_OPTIONS.map(opt => (
                      <button
                        key={opt.type}
                        type="button"
                        className={cn(
                          'flex items-center gap-1 rounded px-2 py-1 text-xs hover:bg-neutral-100',
                          block.type === opt.type && 'bg-primary-50 text-primary-700',
                        )}
                        onClick={() => setBlockType(block.id, opt.type)}
                      >
                        <opt.icon className="h-3 w-3" />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {canEdit && (
          <button
            type="button"
            className="mx-auto mt-6 flex w-full max-w-3xl items-center gap-2 rounded-md px-2 py-2 text-sm text-neutral-400 hover:bg-neutral-50 hover:text-neutral-600"
            onClick={() => {
              const nb = newBlock('paragraph')
              setBlocks(prev => [...prev, nb])
              markDirty()
              setTimeout(() => inputRefs.current[nb.id]?.focus(), 0)
            }}
          >
            <Plus className="h-4 w-4" />
            Click to add a block, or press Enter at the end of a line
          </button>
        )}
      </div>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Delete page?">
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
