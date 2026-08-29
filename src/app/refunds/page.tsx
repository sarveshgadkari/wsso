import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell } from '@/components/marketing/LegalShell'
import { COMPANY } from '@/lib/saas/company'

export const metadata: Metadata = { title: 'Refunds & cancellation — WSSO' }

export default function RefundsPage() {
  return (
    <LegalShell title="Refunds & cancellation" updated="August 29, 2026">
      <p>
        This policy explains how {COMPANY.productName} subscriptions billed by {COMPANY.legalName} work
        in the United States. Charges are in {COMPANY.currencyName} ({COMPANY.currency}) and processed
        by {COMPANY.paymentProcessor}.
      </p>

      <h2>1. Recurring billing</h2>
      <p>
        When you subscribe, you authorize a recurring charge for the plan and interval (monthly or yearly)
        you select at checkout. The subscription renews automatically at the then-current price for that
        plan until you cancel. You will see the amount, currency, and interval before you pay.
      </p>

      <h2>2. How to cancel</h2>
      <p>
        The workspace admin can cancel or change the plan from the in-app Subscription page, or by opening
        the {COMPANY.paymentProcessor} customer portal (card, invoices, and cancellation). Cancellation
        stops future renewals. You keep access until the end of the paid period unless we state otherwise
        at checkout.
      </p>

      <h2>3. Trials</h2>
      <p>
        If a plan includes a trial, cancel before the trial ends to avoid the first paid charge. After the
        trial, the recurring fee is billed as disclosed at checkout.
      </p>

      <h2>4. Refunds</h2>
      <p>
        Subscription fees are generally non-refundable for unused time in a billing period, except where
        U.S. law requires otherwise or where {COMPANY.legalName} agrees in writing. If we approve a refund,
        it is issued in {COMPANY.currency} to the original payment method through {COMPANY.paymentProcessor}.
      </p>

      <h2>5. Failed payments</h2>
      <p>
        If a renewal payment fails, we may retry the charge and restrict workspace access until the
        company admin updates the card and pays. The admin can do that from Subscription in the dashboard.
      </p>

      <h2>6. Changes to plans and prices</h2>
      <p>
        Plan names, seat limits, and list prices are set by the platform owner. A change you make (upgrade,
        downgrade, or interval change) is billed through checkout or the portal. Material price changes for
        a renewal are handled in line with {COMPANY.paymentProcessor} and applicable U.S. consumer rules.
      </p>

      <h2>7. Contact</h2>
      <p>
        Billing questions: sign in as the workspace admin and open Subscription, or send a company inquiry
        at{' '}
        <a href={COMPANY.inquiryUrl} target="_blank" rel="noreferrer">{COMPANY.parentUrl}</a>
        . {COMPANY.responseTime}. Also see our <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalShell>
  )
}
