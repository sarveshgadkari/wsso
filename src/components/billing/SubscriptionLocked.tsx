import Link from 'next/link'
import { CreditCard, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function SubscriptionLocked({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-xl border border-neutral-200 bg-white px-8 py-14 text-center shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-warning-50">
        <Lock className="h-6 w-6 text-warning-700" />
      </div>
      {isAdmin ? (
        <>
          <h2 className="text-xl font-semibold text-neutral-900">Subscribe to unlock this workspace</h2>
          <p className="text-sm text-neutral-500">
            Your company does not have an active WSSO subscription. Choose a plan and pay with Stripe
            to unlock dashboards, time, work orders, and the rest of the app for everyone in this workspace.
          </p>
          <Link href="/settings/billing?pay=1">
            <Button>
              <CreditCard className="h-4 w-4" />
              Take a subscription
            </Button>
          </Link>
        </>
      ) : (
        <>
          <h2 className="text-xl font-semibold text-neutral-900">This workspace is locked</h2>
          <p className="text-sm text-neutral-500">
            Your company has not taken a subscription yet, or it has expired. Contact your workspace
            admin so they can subscribe and unlock WSSO for the team.
          </p>
        </>
      )}
    </div>
  )
}
