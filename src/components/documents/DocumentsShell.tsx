'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import {
  Upload, Download, Trash2, Search, File, FileText, FileImage,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { useToast } from '@/lib/store/toast'
import {
  uploadDocument, getDocuments, deleteDocument, getDownloadUrl,
} from '@/lib/actions/documents'
import type { DocumentMeta } from '@/lib/actions/documents'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024)             return `${bytes} B`
  if (bytes < 1024 * 1024)     return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

function FileIcon({ type }: { type: string | null }) {
  if (type?.startsWith('image/'))                        return <FileImage className="h-4 w-4 text-primary-400" />
  if (type === 'application/pdf' || type?.includes('document') || type?.includes('word'))
                                                         return <FileText className="h-4 w-4 text-red-400" />
  return <File className="h-4 w-4 text-neutral-400" />
}

// ── Upload Dialog ─────────────────────────────────────────────────────────────

interface EntityOption { id: string; code: string; label: string }

interface UploadDialogProps {
  open:     boolean
  onClose:  () => void
  onUploaded: (doc: DocumentMeta) => void
  tactics:  EntityOption[]
  projects: EntityOption[]
  clients:  EntityOption[]
}

function UploadDialog({ open, onClose, onUploaded, tactics, projects, clients }: UploadDialogProps) {
  const toast = useToast()
  const [entityType, setEntityType] = useState<'tactic' | 'project' | 'client'>('tactic')
  const [entityId,   setEntityId]   = useState('')
  const [file,       setFile]       = useState<File | null>(null)
  const [loading,    setLoading]    = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const options = entityType === 'tactic' ? tactics : entityType === 'project' ? projects : clients

  // Reset when reopened
  useEffect(() => {
    if (open) { setEntityId(''); setFile(null); if (fileRef.current) fileRef.current.value = '' }
  }, [open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !entityId) return
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('entity_type', entityType)
      fd.append('entity_id', entityId)
      const doc = await uploadDocument(fd)
      onUploaded(doc as unknown as DocumentMeta)
      toast.success('File uploaded successfully')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Upload Document" size="md">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Entity type */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Attach to</label>
          <div className="flex rounded border border-neutral-300 overflow-hidden">
            {(['tactic', 'project', 'client'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => { setEntityType(t); setEntityId('') }}
                className={`flex-1 py-1.5 text-sm capitalize transition-colors ${
                  entityType === t
                    ? 'bg-primary-600 text-white font-medium'
                    : 'bg-white text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Entity selector */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">
            {entityType === 'tactic' ? 'Tactic' : entityType === 'project' ? 'Project' : 'Client'}
          </label>
          <select
            required
            value={entityId}
            onChange={e => setEntityId(e.target.value)}
            className="h-9 w-full rounded border border-neutral-300 bg-white pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">Select {entityType}…</option>
            {options.map(o => (
              <option key={o.id} value={o.id}>
                [{o.code}] {o.label}
              </option>
            ))}
          </select>
          {options.length === 0 && (
            <p className="text-xs text-neutral-400">No {entityType}s accessible</p>
          )}
        </div>

        {/* File input */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">File</label>
          <input
            ref={fileRef}
            type="file"
            required
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-700
                       file:mr-3 file:rounded file:border-0 file:bg-primary-50 file:px-3 file:py-1 file:text-xs
                       file:font-medium file:text-primary-700 hover:file:bg-primary-100"
          />
          {file && (
            <p className="text-xs text-neutral-500">{file.name} · {fmtSize(file.size)}</p>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading} disabled={!file || !entityId}>
            <Upload className="h-4 w-4" /> Upload
          </Button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

// ── Main Shell ─────────────────────────────────────────────────────────────────

interface Props {
  tactics:  EntityOption[]
  projects: EntityOption[]
  clients:  EntityOption[]
  initialDocs: DocumentMeta[]
  profileId:   string
  isAdmin:     boolean
}

export function DocumentsShell({
  tactics, projects, clients,
  initialDocs, profileId, isAdmin,
}: Props) {
  const toast                          = useToast()
  const [docs,        setDocs]        = useState<DocumentMeta[]>(initialDocs)
  const [showUpload,  setShowUpload]  = useState(false)
  const [search,      setSearch]      = useState('')
  const [entityType,  setEntityType]  = useState('')
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting,    setDeleting]    = useState<string | null>(null)
  const [isPending,   start]          = useTransition()

  // Re-fetch when filters change (debounced for search)
  useEffect(() => {
    const t = setTimeout(() => {
      start(async () => {
        try {
          const data = await getDocuments({ search, entity_type: entityType })
          setDocs(data)
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to load documents')
        }
      })
    }, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [search, entityType, toast])

  function handleUploaded(doc: DocumentMeta) {
    setDocs(prev => [doc, ...prev])
  }

  async function handleDownload(doc: DocumentMeta) {
    setDownloading(doc.id)
    try {
      const url = await getDownloadUrl(doc.file_path)
      window.open(url, '_blank', 'noopener')
    } catch {
      toast.error('Could not generate download link')
    } finally {
      setDownloading(null)
    }
  }

  async function handleDelete(doc: DocumentMeta) {
    if (!confirm(`Delete "${doc.file_name}"? This cannot be undone.`)) return
    setDeleting(doc.id)
    try {
      await deleteDocument(doc.id)
      setDocs(prev => prev.filter(d => d.id !== doc.id))
      toast.success('Document deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  const shown = docs  // filtering already done server-side

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Search files, codes, uploader…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 w-full rounded border border-neutral-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-600">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <select
          value={entityType}
          onChange={e => setEntityType(e.target.value)}
          className="h-9 rounded border border-neutral-300 bg-white pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">All types</option>
          <option value="tactic">Tactics</option>
          <option value="project">Projects</option>
          <option value="client">Clients</option>
        </select>

        <Button onClick={() => setShowUpload(true)}>
          <Upload className="h-4 w-4" /> Upload
        </Button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isPending ? (
          <div className="flex h-40 items-center justify-center text-sm text-neutral-400">Loading…</div>
        ) : shown.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-neutral-400">
            <File className="h-8 w-8 text-neutral-300" />
            {search || entityType ? 'No documents match your filters' : 'No documents yet — click Upload to add the first one'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">File</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Linked to</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-400">Uploaded by</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Size</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-neutral-400" />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {shown.map(doc => {
                  const canDelete = isAdmin || doc.uploaded_by === profileId
                  return (
                    <tr key={doc.id} className="hover:bg-neutral-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <FileIcon type={doc.file_type} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-neutral-800 max-w-[220px]">{doc.file_name}</p>
                            {doc.file_type && (
                              <p className="text-xs text-neutral-400">{doc.file_type.split('/').pop()?.toUpperCase()}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          {doc.tactic_code  && <code className="text-xs bg-primary-50  text-primary-700  rounded px-1.5 py-0.5 w-fit">{doc.tactic_code}</code>}
                          {doc.project_code && <code className="text-xs bg-neutral-100 text-neutral-700  rounded px-1.5 py-0.5 w-fit">{doc.project_code}</code>}
                          {doc.client_code  && <code className="text-xs bg-success-50  text-success-700  rounded px-1.5 py-0.5 w-fit">{doc.client_code}</code>}
                          {doc.company_code && <code className="text-xs bg-warning-50  text-warning-700  rounded px-1.5 py-0.5 w-fit">{doc.company_code}</code>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-600">
                        {(doc.uploader as { full_name: string } | null)?.full_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs tabular-nums text-neutral-500">
                        {fmtSize(doc.file_size)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-neutral-400">
                        {fmtDate(doc.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleDownload(doc)}
                            disabled={downloading === doc.id}
                            aria-label="Download"
                            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-primary-600 disabled:opacity-50"
                          >
                            {downloading === doc.id
                              ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
                              : <Download className="h-4 w-4" />
                            }
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(doc)}
                              disabled={deleting === doc.id}
                              aria-label="Delete"
                              className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-danger-600 disabled:opacity-50"
                            >
                              {deleting === doc.id
                                ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-danger-400 border-t-transparent" />
                                : <Trash2 className="h-4 w-4" />
                              }
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {shown.length > 0 && (
        <p className="text-right text-xs text-neutral-400">{shown.length} document{shown.length !== 1 ? 's' : ''}</p>
      )}

      <UploadDialog
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onUploaded={handleUploaded}
        tactics={tactics}
        projects={projects}
        clients={clients}
      />
    </div>
  )
}
