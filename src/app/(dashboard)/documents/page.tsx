import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { getDocuments } from '@/lib/actions/documents'
import { DocumentsShell } from '@/components/documents/DocumentsShell'

export const metadata = { title: 'Documents — WSSO' }

export default async function DocumentsPage() {
  const profile  = await requireProfile()
  const supabase = await createClient()

  // Entity options for the upload dialog — scoped by RLS automatically
  const [tacticsRes, projectsRes, clientsRes, initialDocs] = await Promise.all([
    supabase
      .from('tactics')
      .select('id, code, title')
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('projects')
      .select('id, code, name')
      .eq('status', 'active')
      .order('name'),
    supabase
      .from('clients')
      .select('id, code, name')
      .eq('status', 'active')
      .order('name'),
    getDocuments({}),
  ])

  const tactics  = (tacticsRes.data  ?? []).map((t: { id: string; code: string; title: string }) => ({
    id: t.id, code: t.code, label: t.title,
  }))
  const projects = (projectsRes.data ?? []).map((p: { id: string; code: string; name: string }) => ({
    id: p.id, code: p.code, label: p.name,
  }))
  const clients  = (clientsRes.data  ?? []).map((c: { id: string; code: string; name: string }) => ({
    id: c.id, code: c.code, label: c.name,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Documents</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Files attached to tactics, projects, and clients. Upload to link a file to any entity.
        </p>
      </div>

      <DocumentsShell
        tactics={tactics}
        projects={projects}
        clients={clients}
        initialDocs={initialDocs}
        profileId={profile.id}
        isAdmin={profile.role === 'admin'}
      />
    </div>
  )
}
