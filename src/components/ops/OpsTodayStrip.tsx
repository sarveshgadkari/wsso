import Link from 'next/link'
import { Inbox, ShieldAlert, Handshake } from 'lucide-react'

export function OpsTodayStrip({
  pendingApprovals,
  expiringCompliance,
  overdueFollowUps,
  showCrm,
  showCompliance,
  showApprovals,
}: {
  pendingApprovals: number
  expiringCompliance: number
  overdueFollowUps: number
  showCrm: boolean
  showCompliance: boolean
  showApprovals: boolean
}) {
  const items = [
    showApprovals && {
      href: '/approvals',
      label: 'Approvals waiting',
      value: pendingApprovals,
      icon: Inbox,
      warn: pendingApprovals > 0,
    },
    showCompliance && {
      href: '/compliance',
      label: 'Expiring in 30 days',
      value: expiringCompliance,
      icon: ShieldAlert,
      warn: expiringCompliance > 0,
    },
    showCrm && {
      href: '/crm',
      label: 'Overdue follow-ups',
      value: overdueFollowUps,
      icon: Handshake,
      warn: overdueFollowUps > 0,
    },
  ].filter(Boolean) as { href: string; label: string; value: number; icon: typeof Inbox; warn: boolean }[]

  if (items.length === 0) return null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`card flex items-center gap-3 px-4 py-3 hover:bg-neutral-50 ${item.warn ? 'border-amber-200' : ''}`}
        >
          <item.icon className={`h-4 w-4 ${item.warn ? 'text-amber-600' : 'text-neutral-400'}`} />
          <div>
            <p className="text-lg font-semibold text-neutral-900">{item.value}</p>
            <p className="text-xs text-neutral-500">{item.label}</p>
          </div>
        </Link>
      ))}
    </div>
  )
}
