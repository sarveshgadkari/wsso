'use server'

import { revalidatePath } from 'next/cache'
import { requireProfile } from '@/lib/auth/session'
import { requireOrgId } from '@/lib/saas/tenant'
import { createClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'

export interface DocumentMeta {
  id:            string
  file_name:     string
  file_path:     string | null
  file_type:     string | null
  file_size:     number | null
  source_type:   'file' | 'link'
  external_url:  string | null
  company_code:  string | null
  employee_code: string | null
  client_code:   string | null
  project_code:  string | null
  tactic_code:   string | null
  uploaded_by:   string
  created_at:    string
  uploader:      { full_name: string } | null
}

const BUCKET = 'documents'

interface EntityCodes {
  company_code:  string | null
  employee_code: string | null
  client_code:   string | null
  project_code:  string | null
  tactic_code:   string | null
}

async function ensureBucket() {
  await supabaseAdmin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: '50mb',
  }).catch(() => {/* already exists */})
}

async function resolveEntityCodes(
  supabase: Awaited<ReturnType<typeof createClient>>,
  entityType: string,
  entityId: string,
  orgId: string,
): Promise<EntityCodes> {
  let company_code:  string | null = null
  let employee_code: string | null = null
  let client_code:   string | null = null
  let project_code:  string | null = null
  let tactic_code:   string | null = null

  if (entityType === 'tactic') {
    const { data: tactic } = await supabase
      .from('tactics')
      .select(`
        code,
        assignee:profiles!tactics_assigned_to_fkey(employee_code),
        project:projects!tactics_project_id_fkey(
          code,
          client:clients!projects_client_id_fkey(code),
          company:companies!projects_company_id_fkey(code)
        )
      `)
      .eq('id', entityId)
      .eq('organization_id', orgId)
      .single()

    if (!tactic) throw new Error('Work order not found or access denied')

    tactic_code   = tactic.code
    const a = tactic.assignee as unknown as { employee_code: string } | null
    employee_code = a?.employee_code ?? null

    const p = tactic.project as unknown as {
      code: string
      client:  { code: string } | null
      company: { code: string } | null
    } | null

    if (p) {
      project_code = p.code
      client_code  = p.client?.code  ?? null
      company_code = p.company?.code ?? null
    }

  } else if (entityType === 'project') {
    const { data: project } = await supabase
      .from('projects')
      .select(`
        code,
        client:clients!projects_client_id_fkey(code),
        company:companies!projects_company_id_fkey(code)
      `)
      .eq('id', entityId)
      .eq('organization_id', orgId)
      .single()

    if (!project) throw new Error('Project not found or access denied')

    project_code = project.code
    const p = project as unknown as { code: string; client: { code: string } | null; company: { code: string } | null }
    client_code  = p.client?.code  ?? null
    company_code = p.company?.code ?? null

  } else if (entityType === 'client') {
    const { data: client } = await supabase
      .from('clients')
      .select(`
        code,
        company:companies!clients_company_id_fkey(code)
      `)
      .eq('id', entityId)
      .eq('organization_id', orgId)
      .single()

    if (!client) throw new Error('Client not found or access denied')

    client_code  = client.code
    const c = client as unknown as { code: string; company: { code: string } | null }
    company_code = c.company?.code ?? null

  } else {
    throw new Error(`Unknown entity type: ${entityType}`)
  }

  return { company_code, employee_code, client_code, project_code, tactic_code }
}

function normalizeLink(url: string): string {
  const trimmed = url.trim()
  if (!trimmed.startsWith('https://')) {
    throw new Error('Link must start with https://')
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:') throw new Error('Only HTTPS links are allowed')
    return parsed.toString()
  } catch {
    throw new Error('Invalid URL')
  }
}

function linkDisplayName(url: string, title?: string): string {
  if (title?.trim()) return title.trim().slice(0, 200)
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return host || url.slice(0, 80)
  } catch {
    return url.slice(0, 80)
  }
}

// ── Upload file ───────────────────────────────────────────────────────────────

export async function uploadDocument(formData: FormData) {
  const profile    = await requireProfile()
  const supabase   = await createClient()
  const file       = formData.get('file')       as File
  const entityType = formData.get('entity_type') as string
  const entityId   = formData.get('entity_id')   as string

  if (!file || file.size === 0) throw new Error('No file provided')
  if (!entityType || !entityId) throw new Error('Entity type and ID are required')

  const codes = await resolveEntityCodes(supabase, entityType, entityId, requireOrgId(profile))

  await ensureBucket()

  const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `${profile.id}/${Date.now()}-${sanitized}`
  const bytes = Buffer.from(await file.arrayBuffer())

  const { error: storageErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, { contentType: file.type || 'application/octet-stream' })

  if (storageErr) throw new Error(`Storage upload failed: ${storageErr.message}`)

  const { data, error: dbErr } = await supabaseAdmin
    .from('documents')
    .insert({
      file_name:     file.name,
      file_path:     storagePath,
      file_type:     file.type || null,
      file_size:     file.size,
      source_type:   'file',
      external_url:  null,
      ...codes,
      uploaded_by:   profile.id,
    })
    .select('*, uploader:profiles!documents_uploaded_by_fkey(full_name)')
    .single()

  if (dbErr) {
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath])
    throw new Error(dbErr.message)
  }

  revalidatePath('/documents')
  revalidatePath('/tactics')
  return data as DocumentMeta
}

// ── Add external link ───────────────────────────────────────────────────────────

export async function addDocumentLink(input: {
  url:         string
  title?:      string
  entity_type: 'tactic' | 'project' | 'client'
  entity_id:   string
}) {
  const profile  = await requireProfile()
  const supabase = await createClient()

  const externalUrl = normalizeLink(input.url)
  const codes = await resolveEntityCodes(supabase, input.entity_type, input.entity_id, requireOrgId(profile))

  const { data, error } = await supabaseAdmin
    .from('documents')
    .insert({
      file_name:     linkDisplayName(externalUrl, input.title),
      file_path:     null,
      file_type:     'text/uri-list',
      file_size:     null,
      source_type:   'link',
      external_url:  externalUrl,
      ...codes,
      uploaded_by:   profile.id,
    })
    .select('*, uploader:profiles!documents_uploaded_by_fkey(full_name)')
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/documents')
  revalidatePath('/tactics')
  return data as DocumentMeta
}

// ── List ───────────────────────────────────────────────────────────────────────

/**
 * Visibility matches documents RLS (not org-wide):
 * - admin / director: all
 * - manager: uploads by people on their team
 * - employee: own uploads OR docs tagged with their employee_code
 */
export async function getDocuments(filters: {
  search?:       string
  tactic_code?:  string
  project_code?: string
  client_code?:  string
  entity_type?:  string
}): Promise<DocumentMeta[]> {
  await requireProfile()
  const supabase = await createClient()

  // User-scoped client so docs_* RLS applies (never list via service role).
  let q = supabase
    .from('documents')
    .select('*, uploader:profiles!documents_uploaded_by_fkey(full_name)')
    .order('created_at', { ascending: false })
    .limit(300)

  if (filters.tactic_code)  q = q.eq('tactic_code',  filters.tactic_code)
  if (filters.project_code) q = q.eq('project_code', filters.project_code)
  if (filters.client_code)  q = q.eq('client_code',  filters.client_code)
  if (filters.entity_type === 'tactic')  q = q.not('tactic_code',  'is', null)
  if (filters.entity_type === 'project') q = q.not('project_code', 'is', null)
  if (filters.entity_type === 'client')  q = q.not('client_code',  'is', null)

  const { data, error } = await q
  if (error) throw new Error(error.message)

  let results = (data ?? []) as DocumentMeta[]

  // Fill missing uploader names (profile embed can be null under RLS)
  const missingUploaderIds = results
    .filter(d => !d.uploader?.full_name && d.uploaded_by)
    .map(d => d.uploaded_by)
  if (missingUploaderIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name')
      .in('id', Array.from(new Set(missingUploaderIds)))
    const map = Object.fromEntries(
      ((profiles ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p]),
    )
    results = results.map(d => ({
      ...d,
      uploader: d.uploader?.full_name
        ? d.uploader
        : (map[d.uploaded_by] ? { full_name: map[d.uploaded_by].full_name } : d.uploader),
    }))
  }

  if (filters.search) {
    const s = filters.search.toLowerCase()
    results = results.filter(d =>
      d.file_name?.toLowerCase().includes(s) ||
      d.external_url?.toLowerCase().includes(s) ||
      d.tactic_code?.toLowerCase().includes(s) ||
      d.project_code?.toLowerCase().includes(s) ||
      d.client_code?.toLowerCase().includes(s) ||
      d.company_code?.toLowerCase().includes(s) ||
      d.employee_code?.toLowerCase().includes(s) ||
      d.uploader?.full_name?.toLowerCase().includes(s),
    )
  }

  return results
}

/** Confirm the current user can see this document under RLS before signing URLs. */
async function requireAccessibleDocument(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .select('id, source_type, file_path, external_url, uploaded_by')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error('Document not found or access denied')
  return data
}

// ── Open (file download URL or external link) ─────────────────────────────────

export async function getDocumentOpenUrl(id: string): Promise<string> {
  await requireProfile()
  const doc = await requireAccessibleDocument(id)

  if (doc.source_type === 'link') {
    if (!doc.external_url) throw new Error('Link is missing')
    return normalizeLink(doc.external_url)
  }

  if (!doc.file_path) throw new Error('File path is missing')

  const { data, error: urlErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(doc.file_path, 3600)

  if (urlErr || !data?.signedUrl) throw new Error('Could not generate download link')
  return data.signedUrl
}

/** @deprecated Use getDocumentOpenUrl */
export async function getDownloadUrl(filePath: string): Promise<string> {
  await requireProfile()
  const supabase = await createClient()

  // Must be able to see a document row with this path (RLS)
  const { data: doc } = await supabase
    .from('documents')
    .select('id')
    .eq('file_path', filePath)
    .maybeSingle()

  if (!doc) throw new Error('Document not found or access denied')

  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 3600)
  if (error || !data?.signedUrl) throw new Error('Could not generate download link')
  return data.signedUrl
}

// ── Delete ─────────────────────────────────────────────────────────────────────

export async function deleteDocument(id: string) {
  const profile = await requireProfile()

  // RLS must allow SELECT; then enforce delete rules in app
  const doc = await requireAccessibleDocument(id)

  if (profile.role !== 'admin' && doc.uploaded_by !== profile.id) {
    throw new Error('You can only delete your own files')
  }

  if (doc.source_type === 'file' && doc.file_path) {
    await supabaseAdmin.storage.from(BUCKET).remove([doc.file_path])
  }

  await supabaseAdmin.from('documents').delete().eq('id', id)

  revalidatePath('/documents')
  revalidatePath('/tactics')
}
