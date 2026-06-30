import { redirect } from 'next/navigation'
import { requireProfile } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { ClientsTable, type ClientRow } from '@/components/clients/ClientsTable'

export const metadata = { title: 'Clients — WSSO' }

export default async function ClientsPage() {
  const profile = await requireProfile()
  if (!['admin', 'manager'].includes(profile.role)) redirect('/dashboard')

  const supabase = await createClient()

  const [clientsRes, companiesRes] = await Promise.all([
    supabase
      .from('clients')
      .select('*, company:companies(id, name, code)')
      .order('name'),
    supabase.from('companies').select('id, name, code').order('name'),
  ])

  const clients   = (clientsRes.data  ?? []) as unknown as ClientRow[]
  const companies = companiesRes.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Clients</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Business clients linked to your companies. Client codes are auto-generated (CLI001…).
        </p>
      </div>

      <ClientsTable initialClients={clients} companies={companies} />
    </div>
  )
}
