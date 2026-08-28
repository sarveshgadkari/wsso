import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireSuperAdmin } from '@/lib/auth/session'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { OrgDetailForm } from '@/components/platform/OrgDetailForm'
import { getOrgUsageStats } from '@/lib/saas/org-usage'
import { ArrowLeft } from 'lucide-react'

interface Props {
  params: { id: string }
}

export async function generateMetadata() {
  return { title: 'Workspace — Platform — WSSO' }
}

export default async function PlatformOrgPage({ params }: Props) {
  await requireSuperAdmin()

  const { data: org } = await supabaseAdmin
    .from('organizations')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!org) notFound()

  const [{ data: members }, plansRes, usage] = await Promise.all([
    supabaseAdmin
      .from('profiles')
      .select('id, full_name, email, role, status, employee_code')
      .eq('organization_id', org.id)
      .order('full_name'),
    supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .order('sort_order'),
    getOrgUsageStats(org.id),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/platform" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
          <ArrowLeft className="h-4 w-4" />
          All workspaces
        </Link>
        <h2 className="mt-2 text-xl font-semibold text-neutral-900">{org.name}</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Users, usage, plan, and billing for this customer — use this to charge the right amount.
        </p>
      </div>

      <OrgDetailForm
        org={org}
        plans={plansRes.data ?? []}
        members={members ?? []}
        stats={usage}
      />
    </div>
  )
}
