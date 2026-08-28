'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { updateOrganization, inviteOrgAdmin, setOrganizationStatus } from '@/lib/actions/platform'
import { markOrganizationPaid } from '@/lib/actions/billing'
import { useToast } from '@/lib/store/toast'
import { formatUsd, STATUS_LABELS, orgNeedsPayment } from '@/lib/saas/plans'
import type { Organization, OrgStatus, Profile, SubscriptionPlan } from '@/lib/types'
import type { OrgUsageStats } from '@/lib/saas/org-usage'

interface Props {
  org: Organization
  plans: SubscriptionPlan[]
  members: Pick<Profile, 'id' | 'full_name' | 'email' | 'role' | 'status' | 'employee_code'>[]
  stats: OrgUsageStats
}

export function OrgDetailForm({ org, plans, members, stats }: Props) {
  const router = useRouter()
  const toast = useToast()
  const [name, setName] = useState(org.name)
  const [planId, setPlanId] = useState(org.plan_id ?? plans[0]?.id ?? '')
  const [status, setStatus] = useState<OrgStatus>(org.status)
  const [seatLimit, setSeatLimit] = useState(String(org.seat_limit))
  const [billingEmail, setBillingEmail] = useState(org.billing_email ?? '')
  const [notes, setNotes] = useState(org.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [payBusy, setPayBusy] = useState(false)

  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)

  const selectedPlan = plans.find((p) => p.id === planId)

  const save = async () => {
    setBusy(true)
    const result = await updateOrganization(org.id, {
      name,
      plan_id: planId || undefined,
      status,
      seat_limit: Number(seatLimit) || selectedPlan?.seat_limit,
      billing_email: billingEmail,
      notes,
    })
    setBusy(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success('Workspace updated')
    router.refresh()
  }

  const recordPaid = async (interval: 'month' | 'year') => {
    if (!planId) return
    setPayBusy(true)
    const result = await markOrganizationPaid({
      organizationId: org.id,
      planId,
      interval,
      notes: 'Marked paid by Super Admin',
    })
    setPayBusy(false)
    if (result.error) toast.error(result.error)
    else {
      toast.success('Subscription marked paid. Workspace is active.')
      router.refresh()
    }
  }

  const quickStatus = async (next: OrgStatus) => {
    const result = await setOrganizationStatus(org.id, next)
    if (result.error) toast.error(result.error)
    else {
      toast.success(`Status set to ${STATUS_LABELS[next]}`)
      setStatus(next)
      router.refresh()
    }
  }

  const invite = async () => {
    if (!adminName.trim() || !adminEmail.trim()) {
      toast.error('Admin name and email are required')
      return
    }
    setInviteBusy(true)
    const result = await inviteOrgAdmin(org.id, adminName.trim(), adminEmail.trim())
    setInviteBusy(false)
    if (result.error) {
      toast.error(result.error)
      return
    }
    toast.success(result.data?.email_sent ? 'Admin invited by email' : 'Admin created — email may need a manual link')
    setAdminName('')
    setAdminEmail('')
    router.refresh()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card flex flex-col gap-4 p-5 lg:col-span-2">
        <h3 className="text-sm font-semibold text-neutral-900">Workspace settings</h3>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <p className="text-xs text-neutral-400">
          Slug <span className="font-mono">{org.slug}</span> (not editable)
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Plan" value={planId} onChange={(e) => {
            const next = e.target.value
            setPlanId(next)
            const p = plans.find((x) => x.id === next)
            if (p) setSeatLimit(String(p.seat_limit))
          }}>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatUsd(p.monthly_price_cents)}/mo
              </option>
            ))}
          </Select>
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as OrgStatus)}>
            {(Object.keys(STATUS_LABELS) as OrgStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </Select>
        </div>
        <Input label="Seat limit" type="number" min={1} value={seatLimit} onChange={(e) => setSeatLimit(e.target.value)} />
        <Input label="Billing email" type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Internal notes</label>
          <textarea
            className="min-h-[80px] rounded border border-neutral-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} loading={busy}>Save changes</Button>
          <Button variant="secondary" type="button" loading={payBusy} onClick={() => recordPaid('month')}>
            Mark paid (monthly)
          </Button>
          <Button variant="secondary" type="button" loading={payBusy} onClick={() => recordPaid('year')}>
            Mark paid (yearly)
          </Button>
          {status !== 'suspended' && (
            <Button variant="destructive" type="button" onClick={() => quickStatus('suspended')}>Suspend</Button>
          )}
          {status === 'suspended' && (
            <Button variant="secondary" type="button" onClick={() => quickStatus('active')}>Reactivate</Button>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          Workspace admins pay with Stripe on Billing. Use Mark paid only for offline invoice or bank transfer.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900">Usage (for billing)</h3>
          <p className="mt-1 text-xs text-neutral-400">
            {orgNeedsPayment(org) ? 'No active subscription — team dashboards are locked.' : 'Workspace is unlocked.'}
          </p>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-neutral-500">Active users</dt>
              <dd className="font-medium tabular-nums">{stats.usersActive} / {org.seat_limit} seats</dd>
            </div>
            <div className="flex justify-between text-xs">
              <dt className="text-neutral-400">Admins</dt>
              <dd className="tabular-nums">{stats.admins}</dd>
            </div>
            <div className="flex justify-between text-xs">
              <dt className="text-neutral-400">Directors</dt>
              <dd className="tabular-nums">{stats.directors}</dd>
            </div>
            <div className="flex justify-between text-xs">
              <dt className="text-neutral-400">Managers</dt>
              <dd className="tabular-nums">{stats.managers}</dd>
            </div>
            <div className="flex justify-between text-xs">
              <dt className="text-neutral-400">Employees</dt>
              <dd className="tabular-nums">{stats.employees}</dd>
            </div>
            <div className="flex justify-between border-t border-neutral-100 pt-2">
              <dt className="text-neutral-500">Companies</dt>
              <dd className="font-medium">{stats.companies}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Clients</dt>
              <dd className="font-medium">{stats.clients}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Projects</dt>
              <dd className="font-medium">{stats.projects}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Work orders</dt>
              <dd className="font-medium">{stats.workOrders}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Documents</dt>
              <dd className="font-medium">{stats.documents}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-neutral-500">Time logs</dt>
              <dd className="font-medium">{stats.timeLogs}</dd>
            </div>
            <div className="flex justify-between border-t border-neutral-100 pt-2">
              <dt className="text-neutral-500">Last paid</dt>
              <dd className="font-medium">
                {stats.lastPaidAt
                  ? `${formatUsd(stats.lastPaidCents ?? 0)} · ${new Date(stats.lastPaidAt).toLocaleDateString()}`
                  : 'Never'}
              </dd>
            </div>
            {org.current_period_end && (
              <div className="flex justify-between">
                <dt className="text-neutral-500">Period ends</dt>
                <dd className="font-medium">{new Date(org.current_period_end).toLocaleDateString()}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-900">Invite workspace admin</h3>
          <div className="mt-3 flex flex-col gap-3">
            <Input label="Name" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
            <Input label="Email" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
            <Button size="sm" onClick={invite} loading={inviteBusy}>Send invite</Button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden p-0 lg:col-span-3">
        <div className="border-b border-neutral-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-neutral-900">People in this workspace</h3>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="px-5 py-2 font-semibold">Name</th>
              <th className="px-5 py-2 font-semibold">Email</th>
              <th className="px-5 py-2 font-semibold">Role</th>
              <th className="px-5 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-8 text-center text-neutral-400">No users yet. Invite an admin.</td></tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className="border-t border-neutral-100">
                <td className="px-5 py-2">
                  <p className="font-medium">{m.full_name}</p>
                  <p className="font-mono text-[11px] text-neutral-400">{m.employee_code}</p>
                </td>
                <td className="px-5 py-2 text-neutral-600">{m.email}</td>
                <td className="px-5 py-2 capitalize">{m.role}</td>
                <td className="px-5 py-2 capitalize">{m.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
