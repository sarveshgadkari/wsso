import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalShell } from '@/components/marketing/LegalShell'
import { COMPANY } from '@/lib/saas/company'

export const metadata: Metadata = { title: 'Terms of Service — WSSO' }

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="August 29, 2026">
      <p>
        These Terms of Service (“Terms”) govern access to {COMPANY.productFullName} (“WSSO,” “the Service”),
        a software product of {COMPANY.legalName} (“we,” “us,” or “Company”), a United States {COMPANY.entity}{' '}
        with global headquarters in the {COMPANY.headquarters}. WSSO is offered under the Company’s{' '}
        {COMPANY.division} division. By creating a workspace or subscribing, you agree to these Terms.
      </p>

      <h2>1. Seller of record</h2>
      <p>
        {COMPANY.legalName} is the seller of record for WSSO subscriptions. Company information is published
        at{' '}
        <a href={COMPANY.parentUrl} target="_blank" rel="noreferrer">{COMPANY.parentUrl}</a>.
        Product inquiries receive a response {COMPANY.responseTime.toLowerCase()}.
      </p>

      <h2>2. Eligibility and accounts</h2>
      <p>
        You must be able to form a binding contract under United States law. The person who creates the
        workspace is the company administrator and is responsible for users invited into that workspace,
        for payment, and for lawful use of the Service.
      </p>

      <h2>3. The Service</h2>
      <p>
        WSSO is a work-management platform (time, people, work orders, CRM, training, and related tools).
        Features may change. We do not guarantee uninterrupted or error-free operation.
      </p>

      <h2>4. Subscriptions, prices, and auto-renewal</h2>
      <ul>
        <li>Prices are shown and billed in {COMPANY.currencyName} ({COMPANY.currency}).</li>
        <li>The workspace admin pays one recurring subscription for the whole company (all seats on the plan).</li>
        <li>Published prices come from the live plan list and may change; the rate you accept at checkout applies until you change plan or cancel.</li>
        <li>Subscriptions auto-renew at the end of each monthly or yearly period until canceled.</li>
        <li>Card payments are processed by {COMPANY.paymentProcessor}. We do not store full card numbers.</li>
        <li>If a plan includes a trial, you authorize {COMPANY.paymentProcessor} to charge the then-current price when the trial ends unless you cancel first.</li>
      </ul>
      <p>
        Recurring billing is a negative-option arrangement under U.S. law. You give express informed consent
        when you complete checkout. You can cancel from the admin Subscription page or the {COMPANY.paymentProcessor}{' '}
        customer portal. See our{' '}
        <Link href="/refunds">Refunds &amp; cancellation</Link> policy.
      </p>

      <h2>5. Taxes</h2>
      <p>
        Prices may be exclusive of applicable U.S. sales, use, or similar taxes. If tax is due, it may be
        collected at checkout or invoiced as required by law.
      </p>

      <h2>6. Acceptable use</h2>
      <p>
        You may not misuse the Service, attempt unauthorized access, violate others’ rights, or use WSSO
        for unlawful activity. We may suspend a workspace that violates these Terms or that is unpaid.
      </p>

      <h2>7. Data and privacy</h2>
      <p>
        How we collect and use personal information is described in our{' '}
        <Link href="/privacy">Privacy Policy</Link>. You are responsible for data you and your users put
        into the workspace, including employment records.
      </p>

      <h2>8. Disclaimers and limitation of liability</h2>
      <p>
        THE SERVICE IS PROVIDED “AS IS.” TO THE MAXIMUM EXTENT PERMITTED BY U.S. LAW, WE DISCLAIM IMPLIED
        WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. OUR TOTAL
        LIABILITY FOR ANY CLAIM RELATED TO THE SERVICE IS LIMITED TO THE AMOUNTS YOU PAID US FOR WSSO IN
        THE TWELVE MONTHS BEFORE THE CLAIM. SOME STATES DO NOT ALLOW CERTAIN LIMITATIONS, SO THEY MAY NOT
        APPLY TO YOU.
      </p>

      <h2>9. Governing law</h2>
      <p>
        These Terms are governed by the laws of the United States and the state in which {COMPANY.legalName}{' '}
        maintains its principal U.S. place of business, without regard to conflict-of-law rules. Courts in
        the United States have exclusive jurisdiction, except where applicable law gives you a non-waivable
        right to bring a claim in another forum.
      </p>

      <h2>10. Contact</h2>
      <p>
        {COMPANY.legalName}<br />
        Global Headquarters: {COMPANY.headquarters}<br />
        Product: {COMPANY.productFullName}<br />
        Company inquiries:{' '}
        <a href={COMPANY.inquiryUrl} target="_blank" rel="noreferrer">{COMPANY.parentUrl}</a>
        {' '}({COMPANY.responseTime})
      </p>
    </LegalShell>
  )
}
