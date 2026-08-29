import type { Metadata } from 'next'
import { LegalShell } from '@/components/marketing/LegalShell'
import { COMPANY } from '@/lib/saas/company'

export const metadata: Metadata = { title: 'Privacy Policy — WSSO' }

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="August 29, 2026">
      <p>
        This Privacy Policy describes how {COMPANY.legalName} (“we,” “us”) collects, uses, and shares
        personal information when you use {COMPANY.productFullName} in the United States. WSSO is a product
        of our {COMPANY.division} division. Our public company site is{' '}
        <a href={COMPANY.parentUrl} target="_blank" rel="noreferrer">{COMPANY.parentUrl}</a>.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li>Account data: name, work email, password (hashed), company/workspace name, role.</li>
        <li>Billing data: billing email, plan, seats, and payment status. Card details are collected by {COMPANY.paymentProcessor}, not stored by us as full card numbers.</li>
        <li>Workspace content you and your users enter (time logs, work orders, documents, CRM, training, and similar records).</li>
        <li>Technical data: IP address, browser type, device, and log data needed to operate and secure the Service.</li>
      </ul>

      <h2>2. How we use information</h2>
      <p>
        We use information to provide and secure WSSO, bill subscriptions, communicate about the account,
        prevent fraud and abuse, and comply with U.S. law. We do not sell personal information.
      </p>

      <h2>3. Sharing</h2>
      <p>
        We share information with processors who help us run the Service, including hosting, authentication,
        and {COMPANY.paymentProcessor} for payments. We may disclose information if required by law or to
        protect the Company, users, or the public. Workspace admins can see data for their own company.
      </p>

      <h2>4. Payments</h2>
      <p>
        Recurring charges are processed in {COMPANY.currencyName} by {COMPANY.paymentProcessor}. Stripe’s
        use of card data is governed by Stripe’s own terms and privacy notice.
      </p>

      <h2>5. Retention</h2>
      <p>
        We keep account and billing records as long as the workspace is active and as required for tax,
        accounting, and legal obligations in the United States. You may request deletion of a workspace
        through an authorized company inquiry, subject to those obligations.
      </p>

      <h2>6. Security</h2>
      <p>
        We use administrative, technical, and organizational measures appropriate to a business SaaS
        product. No method of transmission or storage is 100% secure.
      </p>

      <h2>7. California residents (CCPA / CPRA)</h2>
      <p>
        If you are a California resident, you may have the right to request access to, correction of, or
        deletion of personal information, and to opt out of certain sharing. We do not sell personal
        information as that term is defined under California law. To exercise rights, submit an inquiry
        via{' '}
        <a href={COMPANY.inquiryUrl} target="_blank" rel="noreferrer">{COMPANY.parentUrl}</a>.
        We will not discriminate against you for exercising these rights.
      </p>

      <h2>8. Children</h2>
      <p>
        WSSO is a business product. It is not directed to children under 13, and we do not knowingly
        collect personal information from children under 13.
      </p>

      <h2>9. Contact</h2>
      <p>
        Privacy inquiries: {COMPANY.legalName}, Global Headquarters, {COMPANY.headquarters}.{' '}
        Submit via{' '}
        <a href={COMPANY.inquiryUrl} target="_blank" rel="noreferrer">{COMPANY.parentUrl}</a>
        . Response: {COMPANY.responseTime}.
      </p>
    </LegalShell>
  )
}
