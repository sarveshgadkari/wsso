'use client'

import { useEffect, useState, useTransition } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import { StarterKit } from '@tiptap/starter-kit'
import { TextAlign } from '@tiptap/extension-text-align'
import { TextStyleKit } from '@tiptap/extension-text-style'
import { Highlight } from '@tiptap/extension-highlight'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TableKit } from '@tiptap/extension-table'
import { Image } from '@tiptap/extension-image'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, CheckSquare, Quote, Code2, Link2, Link2Off, Table2, ImagePlus, Minus,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Undo2, Redo2, Eraser,
  Rows3, Columns3, Trash2 as TableTrash, Trash2, Save, ClipboardPlus, Users,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { useToast } from '@/lib/store/toast'
import { updateWorkSheet, deleteWorkSheet, createPersonalWorkOrder } from '@/lib/actions/my-work'
import type { WorkSheet, WorkSheetAccess } from '@/lib/my-work/types'
import { legacyBlocksToHtml } from '@/lib/my-work/blocks-to-html'
import { WorkSheetShareDialog } from './WorkSheetShareDialog'
import { cn } from '@/lib/utils'

interface Props {
  sheet:         WorkSheet
  access:        WorkSheetAccess
  onSheetChange: (sheet: WorkSheet) => void
  onSheetDelete: (id: string) => void
  onShareChange: () => void
}

function ToolbarButton({
  active, disabled, onClick, title, children,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 shrink-0 items-center justify-center rounded transition-colors',
        active ? 'bg-primary-100 text-primary-700' : 'text-neutral-600 hover:bg-neutral-100',
        disabled && 'cursor-not-allowed opacity-30 hover:bg-transparent',
      )}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <div className="mx-1 h-5 w-px shrink-0 bg-neutral-200" />
}

function EditorToolbar({ editor }: { editor: Editor }) {
  const setLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined
    const url = window.prompt('Link URL', previous ?? 'https://')
    if (url === null) return
    if (!url.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  const addImage = () => {
    const url = window.prompt('Image URL')
    if (!url?.trim()) return
    editor.chain().focus().setImage({ src: url.trim() }).run()
  }

  const inTable = editor.isActive('table')

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 bg-neutral-50 px-2 py-1.5">
      <ToolbarButton title="Undo" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Redo" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton title="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Heading 3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton title="Bold" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Italic" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Underline" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Strikethrough" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <label title="Text color" className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-neutral-600 hover:bg-neutral-100">
        <span className="text-sm font-bold" style={{ color: (editor.getAttributes('textStyle').color as string) || undefined }}>A</span>
        <input
          type="color"
          className="h-0 w-0 opacity-0"
          onChange={e => editor.chain().focus().setColor(e.target.value).run()}
        />
      </label>
      <label title="Highlight" className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-neutral-600 hover:bg-neutral-100">
        <span className="rounded bg-yellow-200 px-0.5 text-xs font-bold">H</span>
        <input
          type="color"
          className="h-0 w-0 opacity-0"
          onChange={e => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
        />
      </label>
      <ToolbarButton title="Clear formatting" onClick={() => editor.chain().focus().unsetAllMarks().removeEmptyTextStyle().run()}>
        <Eraser className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}>
        <AlignLeft className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Align center" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}>
        <AlignCenter className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}>
        <AlignRight className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}>
        <AlignJustify className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton title="Bullet list" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Numbered list" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="To-do list" active={editor.isActive('taskList')} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <CheckSquare className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Quote" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Code block" active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <Code2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton title="Link" active={editor.isActive('link')} onClick={setLink}>
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      {editor.isActive('link') && (
        <ToolbarButton title="Remove link" onClick={() => editor.chain().focus().unsetLink().run()}>
          <Link2Off className="h-4 w-4" />
        </ToolbarButton>
      )}
      <ToolbarButton title="Insert image" onClick={addImage}>
        <ImagePlus className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        title="Insert table"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <Table2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton title="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        <Minus className="h-4 w-4" />
      </ToolbarButton>
      {inTable && (
        <>
          <ToolbarDivider />
          <ToolbarButton title="Add row" onClick={() => editor.chain().focus().addRowAfter().run()}>
            <Rows3 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            <Columns3 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton title="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
            <TableTrash className="h-4 w-4" />
          </ToolbarButton>
        </>
      )}
    </div>
  )
}

export function WorkDocumentEditor({ sheet, access, onSheetChange, onSheetDelete, onShareChange }: Props) {
  const toast   = useToast()
  const canEdit = access.canEdit
  const [dirty, setDirty]           = useState(false)
  const [isPending, start]          = useTransition()
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [shareOpen, setShareOpen]   = useState(false)

  const initialContent = sheet.doc_html ?? legacyBlocksToHtml(sheet.blocks)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] }, link: { openOnClick: !canEdit, autolink: true } }),
      TextStyleKit,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start typing…' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true } }),
      Image,
    ],
    content: initialContent,
    editable: canEdit,
    immediatelyRender: false,
    onUpdate: () => setDirty(true),
    editorProps: { attributes: { class: 'tiptap-doc focus:outline-none min-h-[360px]' } },
  }, [sheet.id])

  useEffect(() => {
    editor?.setEditable(canEdit)
  }, [canEdit, editor])

  const save = () => {
    if (!editor) return
    start(async () => {
      try {
        const updated = await updateWorkSheet(sheet.id, { doc_html: editor.getHTML() })
        onSheetChange(updated)
        setDirty(false)
        toast.success('Page saved')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  const createWOFromPage = () => {
    if (!editor) return
    const lines = editor.getText({ blockSeparator: '\n' }).split('\n').map(l => l.trim())
    const title = lines.find(Boolean) ?? sheet.name
    const body  = lines.filter(Boolean).join('\n')

    start(async () => {
      try {
        if (dirty) {
          const updated = await updateWorkSheet(sheet.id, { doc_html: editor.getHTML() })
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">{sheet.name}</h3>
          <p className="text-xs text-neutral-400">Rich-text page — headings, lists, tables, and more</p>
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

      <div className="card overflow-hidden">
        {canEdit && editor && <EditorToolbar editor={editor} />}
        <div className="min-h-[420px] px-4 py-6 sm:px-8">
          <div className="mx-auto max-w-3xl">
            <EditorContent editor={editor} />
          </div>
        </div>
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
