import { supabaseAdmin } from '@/lib/supabase/admin'

export type OrgUsageStats = {
  usersActive: number
  usersTotal: number
  admins: number
  directors: number
  managers: number
  employees: number
  companies: number
  clients: number
  projects: number
  workOrders: number
  documents: number
  timeLogs: number
  lastPaidAt: string | null
  lastPaidCents: number | null
}

async function countInOrg(table: string, orgId: string) {
  const { count } = await supabaseAdmin
    .from(table as 'companies')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
  return count ?? 0
}

export async function getOrgUsageStats(orgId: string): Promise<OrgUsageStats> {
  const [{ data: people }, companies, clients, projects, workOrders, documents, timeLogs, { data: lastPay }] =
    await Promise.all([
      supabaseAdmin.from('profiles').select('role, status').eq('organization_id', orgId),
      countInOrg('companies', orgId),
      countInOrg('clients', orgId),
      countInOrg('projects', orgId),
      countInOrg('tactics', orgId),
      countInOrg('documents', orgId),
      countInOrg('time_logs', orgId),
      supabaseAdmin
        .from('organization_payments')
        .select('paid_at, amount_cents')
        .eq('organization_id', orgId)
        .eq('status', 'paid')
        .order('paid_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

  const list = people ?? []
  const active = list.filter((p) => p.status === 'active')
  const roleCount = (role: string) => active.filter((p) => p.role === role).length

  return {
    usersActive: active.length,
    usersTotal: list.length,
    admins: roleCount('admin'),
    directors: roleCount('director'),
    managers: roleCount('manager'),
    employees: roleCount('employee'),
    companies,
    clients,
    projects,
    workOrders,
    documents,
    timeLogs,
    lastPaidAt: lastPay?.paid_at ?? null,
    lastPaidCents: lastPay?.amount_cents ?? null,
  }
}
