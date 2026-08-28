import Link from 'next/link'
import { CreditCard, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { UserRole } from '@/lib/types'

export function WorkspaceLock({ role }: { role: UserRole }) {
  const isAdmin = role === 'admin'

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-warning-50 text-warning-700">
        <Lock className="h-6 w-6" />
      </div>
      {isAdmin ? (
        <>
          <h2 className="mt-5 text-xl font-semibold text-neutral-900">Subscribe to unlock this workspace</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Your company does not have an active WSSO subscription. Dashboards, time, work orders, and the rest of the app stay locked until you choose a plan.
          </p>
          <Link href="/settings/billing" className="mt-6">
            <Button>
              <CreditCard className="h-4 w-4" />
              Take a subscription
            </Button>
          </Link>
        </>
      ) : (
        <>
          <h2 className="mt-5 text-xl font-semibold text-neutral-900">This workspace is locked</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Your company has not taken a WSSO subscription yet. Contact your administrator so they can subscribe and unlock everyone’s dashboards.
          </p>
        </>
      )}
    </div>
  )
}
