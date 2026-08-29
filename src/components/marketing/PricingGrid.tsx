'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { formatUsd, isSignupEnabled, priceForInterval } from '@/lib/saas/plans'
import type { SubscriptionPlan } from '@/lib/types'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']

export function PricingGrid({ plans }: { plans: SubscriptionPlan[] }) {
  const [interval, setInterval] = useState<'month' | 'year'>('month')
  const signup = isSignupEnabled()

  if (plans.length === 0) {
    return (
      <p className="text-center text-sm text-white/50">
        Plans will appear here once the platform owner publishes them.{' '}
        <Link href="/signup" className="text-gold-400 hover:underline">Start a workspace</Link>
        {' '}or <Link href="/login" className="text-gold-400 hover:underline">sign in</Link>.
      </p>
    )
  }

  return (
    <div className="flex flex-col items-center gap-10">
      <div className="inline-flex border border-white/15 p-1">
        <button
          type="button"
          onClick={() => setInterval('month')}
          className={`px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${
            interval === 'month' ? 'bg-gold-500 text-primary-950' : 'text-white/60 hover:text-white'
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setInterval('year')}
          className={`px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] ${
            interval === 'year' ? 'bg-gold-500 text-primary-950' : 'text-white/60 hover:text-white'
          }`}
        >
          Yearly
        </button>
      </div>

      <div className="grid w-full gap-5 md:grid-cols-2 xl:grid-cols-3">
        {plans.map((plan, i) => {
          const amount = priceForInterval(plan, interval)
          const featured = i === Math.min(1, plans.length - 1)
          const href = signup
            ? `/signup?plan=${plan.id}&interval=${interval}`
            : '/login'
          const cta = 'Create a workspace'

          return (
            <div
              key={plan.id}
              className={`flex flex-col border bg-[#0c0c12] p-7 ${
                featured ? 'border-gold-500/70' : 'border-white/10'
              }`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gold-400">
                {featured ? 'Featured plan' : `Plan ${ROMAN[i] ?? i + 1}`}
              </p>
              <h3 className="mkt-display mt-3 text-2xl font-medium text-white">{plan.name}</h3>
              <p className="mt-2 min-h-[44px] text-sm leading-relaxed text-white/50">
                {plan.description || 'Full WSSO workspace for your company.'}
              </p>
              <p className="mkt-display mt-6 text-4xl text-gold-400">
                {formatUsd(amount)}
                <span className="ml-1 font-sans text-sm font-medium tracking-normal text-white/40">
                  /{interval === 'year' ? 'yr' : 'mo'}
                </span>
              </p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-white/35">
                USD · {plan.seat_limit} seats included · auto-renews until canceled
              </p>
              <ul className="mt-6 flex flex-col gap-2.5 text-sm text-white/70">
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-gold-400" /> Time, leave, and attendance
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-gold-400" /> Work orders, CRM, and documents
                </li>
                <li className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-gold-400" /> Training and reports
                </li>
                {plan.trial_days > 0 && (
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-gold-400" /> {plan.trial_days}-day trial
                  </li>
                )}
              </ul>
              <Link
                href={href}
                className={`mt-8 inline-flex h-11 items-center justify-center px-4 text-[11px] font-semibold uppercase tracking-[0.18em] ${
                  featured
                    ? 'bg-gold-500 text-primary-950 hover:bg-gold-400'
                    : 'border border-white/20 text-white hover:border-gold-400 hover:text-gold-400'
                }`}
              >
                {cta}
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
