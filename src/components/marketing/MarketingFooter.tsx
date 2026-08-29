import Link from 'next/link'
import { BrandLogo } from '@/components/brand/BrandLogo'
import { isSignupEnabled } from '@/lib/saas/plans'
import { COMPANY } from '@/lib/saas/company'

export function MarketingFooter() {
  const signup = isSignupEnabled()

  return (
    <footer className="border-t border-white/10 py-14">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="inline-block rounded-md bg-white px-2 py-1">
            <BrandLogo size={56} href="/" />
          </div>
          <p className="mt-4 max-w-xs text-sm text-white/45">
            {COMPANY.productFullName}. A {COMPANY.division} product of {COMPANY.legalName}.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-white/35">
            Seller of record for WSSO subscriptions. Prices in {COMPANY.currencyName} ({COMPANY.currency}).
            Payments processed by {COMPANY.paymentProcessor}.
          </p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-400">Company</p>
          <div className="mt-4 flex flex-col gap-2 text-sm text-white/55">
            <p>{COMPANY.legalName}</p>
            <p>Est. {COMPANY.founded} · {COMPANY.entity}</p>
            <p>Global Headquarters: {COMPANY.headquarters}</p>
            <a href={COMPANY.parentUrl} target="_blank" rel="noreferrer" className="hover:text-gold-400">
              tlbisbig.world
            </a>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-400">Product</p>
          <div className="mt-4 flex flex-col gap-2 text-sm text-white/55">
            <Link href="/#about" className="hover:text-gold-400">About WSSO</Link>
            <Link href="/#product" className="hover:text-gold-400">Platform</Link>
            <Link href="/#pricing" className="hover:text-gold-400">Plans</Link>
            <Link href="/login" className="hover:text-gold-400">Sign in</Link>
            {signup && <Link href="/signup" className="hover:text-gold-400">Create a workspace</Link>}
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-400">Legal</p>
          <div className="mt-4 flex flex-col gap-2 text-sm text-white/55">
            <Link href="/terms" className="hover:text-gold-400">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-gold-400">Privacy Policy</Link>
            <Link href="/refunds" className="hover:text-gold-400">Refunds & cancellation</Link>
            <a href={COMPANY.inquiryUrl} target="_blank" rel="noreferrer" className="hover:text-gold-400">
              Company inquiry
            </a>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-12 max-w-6xl space-y-2 px-4 text-[11px] leading-relaxed tracking-wide text-white/30">
        <p>
          © {COMPANY.copyrightYear} {COMPANY.legalName}. All rights reserved.
          WSSO is offered in the United States. Recurring subscriptions auto-renew until canceled.
        </p>
        <p>
          {COMPANY.productName} · {COMPANY.division} · A {COMPANY.shortName} company
        </p>
      </div>
    </footer>
  )
}
