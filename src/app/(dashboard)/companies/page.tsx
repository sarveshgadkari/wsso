import { requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { CompaniesTable } from '@/components/companies/CompaniesTable'
import { RoleGuard } from '@/components/auth/RoleGuard'

export const metadata = { title: 'Companies — WSSO' }

export default async function CompaniesPage() {
  await requireRole(['admin'])
  const supabase = await createClient()

  const { data: companies } = await supabase
    .from('companies')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <RoleGuard allow={['admin']}>
      <div className="flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Companies</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Manage the business entities that employees, teams, and projects belong to.
            Company codes are auto-generated (TLB001…).
          </p>
        </div>

        <CompaniesTable initialCompanies={companies ?? []} />
      </div>
    </RoleGuard>
  )
}
