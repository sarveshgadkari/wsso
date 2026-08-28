'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { CreateOrgDialog } from './CreateOrgDialog'
import { PLAN_LABELS, STATUS_LABELS } from '@/lib/saas/plans'
import type { Organization, SubscriptionPlan } from '@/lib/types'

export interface OrgListRow extends Organization {
  seat_count: number
  plan_name?: string
  work_orders: number
  payment_due: boolean
}

function statusVariant(status: Organization['status']) {
  if (status === 'active') return 'success' as const
  if (status === 'trial') return 'info' as const
  if (status === 'past_due') return 'warning' as const
  return 'danger' as const
}

interface Props {
  orgs: OrgListRow[]
  plans: SubscriptionPlan[]
}

export function PlatformOrgTable({ orgs, plans }: Props) {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <>
      <div className="mb-4 flex items-center justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          New workspace
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Workspace</th>
              <th className="px-4 py-3 font-semibold">Plan</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Seats</th>
              <th className="px-4 py-3 font-semibold">Work orders</th>
              <th className="px-4 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody>
            {orgs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-neutral-400">
                  No workspaces yet. Create the first one.
                </td>
              </tr>
            )}
            {orgs.map((org) => (
              <tr key={org.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50">
                <td className="px-4 py-3">
                  <Link href={`/platform/organizations/${org.id}`} className="font-medium text-primary-700 hover:underline">
                    {org.name}
                  </Link>
                  <p className="font-mono text-[11px] text-neutral-400">{org.slug}</p>
                </td>
                <td className="px-4 py-3">{org.plan_name ?? PLAN_LABELS[org.plan]}</td>
                <td className="px-4 py-3">
                  <Badge variant={statusVariant(org.status)}>{STATUS_LABELS[org.status]}</Badge>
                  {org.payment_due && org.status !== 'past_due' && (
                    <p className="mt-1 text-[11px] text-warning-700">Payment due</p>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">
                  {org.seat_count} / {org.seat_limit}
                  {org.seat_count > org.seat_limit && (
                    <span className="ml-1 text-xs text-danger-700">over</span>
                  )}
                </td>
                <td className="px-4 py-3 tabular-nums">{org.work_orders}</td>
                <td className="px-4 py-3 text-neutral-500">
                  {new Date(org.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateOrgDialog open={createOpen} onClose={() => setCreateOpen(false)} plans={plans} />
    </>
  )
}
