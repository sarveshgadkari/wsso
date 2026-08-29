import Link from 'next/link'
import {
  Clock,
  ClipboardList,
  Users,
  GraduationCap,
  Bot,
  BarChart3,
  ChevronDown,
} from 'lucide-react'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { PricingGrid } from '@/components/marketing/PricingGrid'
import { isSignupEnabled } from '@/lib/saas/plans'
import { COMPANY } from '@/lib/saas/company'
import type { SubscriptionPlan } from '@/lib/types'

const CAPABILITIES = [
  {
    roman: 'I',
    icon: Clock,
    title: 'Time & attendance',
    body: 'Clock in and out in each person’s timezone. Shifts never run past local midnight or 24 hours.',
    items: ['Country-aware timezones', 'Local midnight close', 'Leave requests'],
  },
  {
    roman: 'II',
    icon: ClipboardList,
    title: 'Work orders & TACTICs',
    body: 'Assign work, track status on a kanban, and keep the paper trail in one place.',
    items: ['Kanban status', 'Assignments', 'Document trail'],
  },
  {
    roman: 'III',
    icon: Users,
    title: 'People & CRM',
    body: 'Employees, clients, leads, and roles from admin to employee — one company workspace.',
    items: ['Admin · director · manager · employee', 'Clients and leads', 'Company isolation'],
  },
  {
    roman: 'IV',
    icon: GraduationCap,
    title: 'Training & documents',
    body: 'Modules, knowledge checks, and files your team actually uses on the job.',
    items: ['Training modules', 'Knowledge checks', 'Shared files'],
  },
  {
    roman: 'V',
    icon: BarChart3,
    title: 'Reports for the owner',
    body: 'Daily and weekly time, project progress, and performance — ready for the company.',
    items: ['Time reports', 'Project progress', 'Performance'],
  },
  {
    roman: 'VI',
    icon: Bot,
    title: 'Connect AI',
    body: 'Optional MCP so your AI tools can use WSSO with the same permissions as a signed-in user.',
    items: ['Same permissions as people', 'Optional connection', 'Workspace-scoped'],
  },
]

const STEPS = [
  {
    n: '01',
    title: 'Create a workspace',
    body: 'New customers create an admin account for the company. No card yet.',
  },
  {
    n: '02',
    title: 'Choose a plan',
    body: 'Pick a live plan from Super Admin. Monthly or yearly — one bill for every seat.',
  },
  {
    n: '03',
    title: 'Subscribe',
    body: 'Pay with Stripe. Later, the company admin can change or cancel the plan from the dashboard.',
  },
]

const FAQS = [
  {
    q: 'Who pays?',
    a: 'The workspace admin pays for the whole company in United States dollars. Employees never see a bill.',
  },
  {
    q: 'How does payment work?',
    a: 'Card payments are processed by Stripe. Subscriptions auto-renew monthly or yearly until you cancel from Subscription in the admin dashboard or the Stripe portal.',
  },
  {
    q: 'Who is the seller?',
    a: `${COMPANY.legalName} (Est. ${COMPANY.founded}, ${COMPANY.entity}) is the seller of record. WSSO is part of ${COMPANY.division}. Headquarters: ${COMPANY.headquarters}.`,
  },
  {
    q: 'Can we cancel or get a refund?',
    a: 'Yes. Cancel anytime before the next renewal. Unused time in a period is generally not refunded except as required by U.S. law. See Refunds & cancellation.',
  },
]

export function MarketingHome({ plans }: { plans: SubscriptionPlan[] }) {
  const signup = isSignupEnabled()
  const publicPlans = plans.filter(
    (p) => !(p.slug === 'trial' && p.monthly_price_cents === 0 && p.yearly_price_cents === 0),
  )
  const signupHref = signup ? '/signup' : '/login'

  return (
    <div className="marketing-site min-h-screen bg-[#07070a] text-white">
      <MarketingNav signupHref={signupHref} signup={signup} />

      <section className="relative flex min-h-[calc(100vh-76px)] flex-col overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(81,40,136,0.35),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(245,197,24,0.08),_transparent_40%)]" />
        <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-16 lg:py-20">
            <p className="mkt-kicker">
              {COMPANY.legalName} · Est. {COMPANY.founded} · {COMPANY.entity}
            </p>
          <h1 className="mkt-display mt-6 max-w-4xl text-5xl font-medium leading-[1.08] tracking-tight sm:text-6xl lg:text-7xl">
            Run the company.
            <br />
            <em className="italic text-gold-400">In one workspace.</em>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
            WSSO is the daily operations platform for time, people, work orders, CRM, and training.
            The company admin subscribes once. Plans and prices are set by the platform owner.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href={signupHref}
              className="inline-flex h-12 items-center bg-gold-500 px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-950 hover:bg-gold-400"
            >
              {signup ? 'Create a workspace' : 'Sign in'}
            </Link>
            <a
              href="#pricing"
              className="inline-flex h-12 items-center border border-white/25 px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-white hover:border-gold-400 hover:text-gold-400"
            >
              Explore plans
            </a>
          </div>
          {signup && (
            <p className="mt-5 text-sm text-white/55">
              New customer?{' '}
              <Link href="/signup" className="font-medium text-gold-400 hover:underline">
                Create a workspace
              </Link>
              {' '}then choose a plan and subscribe. Already with us?{' '}
              <Link href="/login" className="font-medium text-white hover:underline">Sign in</Link>.
            </p>
          )}
        </div>

        <div className="relative border-t border-white/10">
          <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { value: '1', label: 'Company workspace' },
              { value: '4', label: 'Roles in the org' },
              { value: COMPANY.currency, label: `Billed in ${COMPANY.currencyName}` },
              { value: COMPANY.paymentProcessor, label: 'Payment gateway' },
            ].map((s) => (
              <div key={s.label}>
                <p className="mkt-display text-3xl text-gold-400">{s.value}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
          <a
            href="#about"
            className="absolute bottom-3 left-1/2 hidden -translate-x-1/2 flex-col items-center text-[10px] uppercase tracking-[0.3em] text-white/35 lg:flex"
          >
            Scroll
            <ChevronDown className="mt-1 h-4 w-4" />
          </a>
        </div>
      </section>

      <section id="about" className="border-t border-white/10 py-24">
        <div className="mx-auto grid max-w-6xl gap-14 px-4 lg:grid-cols-2">
          <div>
            <p className="mkt-kicker">About WSSO</p>
            <h2 className="mkt-display mt-4 text-4xl font-medium leading-tight sm:text-5xl">
              Daily operations.
              <br />
              <em className="italic text-gold-400">Institutional discipline.</em>
            </h2>
          </div>
          <div className="text-[15px] leading-relaxed text-white/60">
            <p>
              WSSO is the SME Digital Business Solutions platform of{' '}
              <a
                href="https://www.tlbisbig.world/"
                className="text-gold-400 hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                TLBISBIG
              </a>
              . It is built for companies that need time, people, work, and training in one system —
              with a single subscription paid by the workspace admin.
            </p>
            <p className="mt-4">
              Super Admin publishes the plans. Your admin chooses monthly or yearly, invites the team,
              and the rest of the company works inside that workspace.
            </p>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {[
                { t: 'One bill', d: 'The company admin pays for every seat.' },
                { t: 'Isolated data', d: 'Each workspace stays in its own company.' },
                { t: 'Live prices', d: 'What Super Admin sets is what you subscribe to.' },
              ].map((item) => (
                <div key={item.t}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white">{item.t}</p>
                  <p className="mt-2 text-sm text-white/50">{item.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="product" className="border-t border-white/10 bg-[#0b0b10] py-24">
        <div className="mx-auto max-w-6xl px-4">
          <p className="mkt-kicker">Platform architecture</p>
          <h2 className="mkt-display mt-4 max-w-3xl text-4xl font-medium sm:text-5xl">
            Everything the team needs.{' '}
            <em className="italic text-gold-400">In one login.</em>
          </h2>
          <p className="mt-4 max-w-2xl text-sm text-white/50">
            Roles for admin, director, manager, and employee. Data stays in your company workspace.
          </p>
          <div className="mt-14 grid gap-5 md:grid-cols-2">
            {CAPABILITIES.map((c) => (
              <article key={c.roman} className="border border-white/10 bg-[#07070a] p-7">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gold-400">
                    Capability {c.roman}
                  </p>
                  <c.icon className="h-4 w-4 text-gold-400/80" />
                </div>
                <h3 className="mkt-display mt-4 text-2xl font-medium text-white">{c.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-white/55">{c.body}</p>
                <ul className="mt-5 space-y-2 text-sm text-white/70">
                  {c.items.map((item) => (
                    <li key={item} className="flex gap-2">
                      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-400" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.22em] text-gold-400/80">
                  Active capability
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <p className="mkt-kicker">How it works</p>
          <h2 className="mkt-display mt-4 text-4xl font-medium sm:text-5xl">
            Subscribe in{' '}
            <em className="italic text-gold-400">three steps.</em>
          </h2>
          <div className="mt-14 grid gap-10 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="border-t border-gold-500/40 pt-6">
                <p className="mkt-display text-3xl text-gold-400">{s.n}</p>
                <h3 className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-white">
                  {s.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-white/50">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-t border-white/10 bg-[#0b0b10] py-24">
        <div className="mx-auto max-w-6xl px-4">
          <p className="mkt-kicker">Company subscription</p>
          <h2 className="mkt-display mt-4 text-4xl font-medium sm:text-5xl">
            Plans for the{' '}
            <em className="italic text-gold-400">whole company.</em>
          </h2>
          <p className="mt-4 max-w-2xl text-sm text-white/50">
            New customer? Create a workspace, then choose a plan and subscribe. Prices are in United States
            dollars (USD), billed through Stripe, and auto-renew until canceled.{' '}
            <Link href="/refunds" className="text-gold-400 hover:underline">Refunds &amp; cancellation</Link>.
          </p>
          <div className="mt-14">
            <PricingGrid plans={publicPlans} />
          </div>
          <p className="mx-auto mt-10 max-w-3xl text-center text-xs leading-relaxed text-white/40">
            Seller of record: {COMPANY.legalName}. Recurring subscription. You authorize charges to your
            payment method at the interval you select. Cancel anytime from the admin Subscription page.
            {' '}<Link href="/terms" className="text-gold-400 hover:underline">Terms</Link>
            {' · '}<Link href="/privacy" className="text-gold-400 hover:underline">Privacy</Link>
            {' · '}<Link href="/refunds" className="text-gold-400 hover:underline">Refunds</Link>
          </p>
        </div>
      </section>

      <section className="border-t border-white/10 py-24">
        <div className="mx-auto max-w-3xl px-4">
          <p className="mkt-kicker text-center">Questions</p>
          <h2 className="mkt-display mt-4 text-center text-4xl font-medium">
            Before you <em className="italic text-gold-400">subscribe.</em>
          </h2>
          <div className="mt-12 divide-y divide-white/10 border-y border-white/10">
            {FAQS.map((item) => (
              <div key={item.q} className="py-6">
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-white">{item.q}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="company" className="border-t border-white/10 py-24">
        <div className="mx-auto max-w-6xl px-4">
          <p className="mkt-kicker">Seller of record</p>
          <h2 className="mkt-display mt-4 text-4xl font-medium sm:text-5xl">
            A product of{' '}
            <em className="italic text-gold-400">{COMPANY.shortName}.</em>
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/55">
            {COMPANY.legalName} is a privately held U.S. {COMPANY.entity} founded in {COMPANY.founded}.
            WSSO is offered under Division {COMPANY.divisionRoman}: {COMPANY.division}. Global headquarters:{' '}
            {COMPANY.headquarters}.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: 'Legal name', d: COMPANY.legalName },
              { t: 'Headquarters', d: COMPANY.headquarters },
              { t: 'Payments', d: `${COMPANY.currency} via ${COMPANY.paymentProcessor}` },
              { t: 'Inquiries', d: COMPANY.responseTime },
            ].map((item) => (
              <div key={item.t} className="border-t border-gold-500/40 pt-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-400">{item.t}</p>
                <p className="mt-2 text-sm text-white/70">{item.d}</p>
              </div>
            ))}
          </div>
          <p className="mt-10 max-w-2xl text-sm text-white/45">
            Company and partnership inquiries:{' '}
            <a href={COMPANY.inquiryUrl} className="text-gold-400 hover:underline" target="_blank" rel="noreferrer">
              {COMPANY.parentUrl.replace('https://', '')}
            </a>
            . Product legal pages:{' '}
            <Link href="/terms" className="text-gold-400 hover:underline">Terms</Link>,{' '}
            <Link href="/privacy" className="text-gold-400 hover:underline">Privacy</Link>,{' '}
            <Link href="/refunds" className="text-gold-400 hover:underline">Refunds &amp; cancellation</Link>.
          </p>
        </div>
      </section>

      <section className="border-t border-white/10 bg-gradient-to-b from-[#1a0c2e] to-[#07070a] py-24 text-center">
        <div className="mx-auto max-w-3xl px-4">
          <p className="mkt-kicker">Ready to begin</p>
          <h2 className="mkt-display mt-4 text-4xl font-medium sm:text-5xl">
            Ready to run something
            <br />
            <em className="italic text-gold-400">extraordinary together?</em>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-white/55">
            Create the workspace, choose a plan, and subscribe for the whole company.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link
              href={signupHref}
              className="inline-flex h-12 items-center bg-gold-500 px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-950 hover:bg-gold-400"
            >
              {signup ? 'Create a workspace' : 'Sign in'}
            </Link>
            <a
              href="#pricing"
              className="inline-flex h-12 items-center border border-white/25 px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-white hover:border-gold-400 hover:text-gold-400"
            >
              Explore plans
            </a>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </div>
  )
}
