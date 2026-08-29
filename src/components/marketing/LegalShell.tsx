import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { isSignupEnabled } from '@/lib/saas/plans'

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  const signup = isSignupEnabled()
  return (
    <div className="marketing-site min-h-screen bg-[#07070a] text-white">
      <MarketingNav signupHref={signup ? '/signup' : '/login'} signup={signup} />
      <article className="mx-auto max-w-3xl px-4 py-16">
        <p className="mkt-kicker">Legal</p>
        <h1 className="mkt-display mt-3 text-4xl font-medium text-white">{title}</h1>
        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-white/40">Last updated {updated}</p>
        <div className="legal-copy mt-10 space-y-6 text-sm leading-relaxed text-white/65">
          {children}
        </div>
      </article>
      <MarketingFooter />
    </div>
  )
}
