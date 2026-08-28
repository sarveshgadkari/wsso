import type { OrgPlan, OrgStatus, SubscriptionPlan } from '@/lib/types'

/** Fallback caps if a workspace has no plan_id yet. */
export const PLAN_SEAT_LIMITS: Record<OrgPlan, number> = {
  trial:      10,
  starter:    10,
  growth:     50,
  business:   150,
  enterprise: 500,
}

export const PLAN_LABELS: Record<OrgPlan, string> = {
  trial:      'Trial',
  starter:    'Starter',
  growth:     'Growth',
  business:   'Business',
  enterprise: 'Enterprise',
}

export const STATUS_LABELS: Record<OrgStatus, string> = {
  trial:      'Trial',
  active:     'Active',
  past_due:   'Payment due',
  suspended:  'Suspended',
  cancelled:  'Cancelled',
}

export const TRIAL_DAYS = 14

export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return slug || 'workspace'
}

export function isSignupEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SAAS_SIGNUP_ENABLED !== 'false'
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY)
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function planEnumFromSlug(slug: string): OrgPlan {
  if (slug === 'trial' || slug === 'starter' || slug === 'growth' || slug === 'business' || slug === 'enterprise') {
    return slug
  }
  return 'business'
}

export function periodEndFromInterval(interval: 'month' | 'year', from = new Date()): Date {
  const d = new Date(from)
  if (interval === 'year') d.setFullYear(d.getFullYear() + 1)
  else d.setMonth(d.getMonth() + 1)
  return d
}

/** Super Admin froze the workspace — nobody in that org can log in. */
export function orgHardBlocked(org: { status: OrgStatus }): boolean {
  return org.status === 'suspended' || org.status === 'cancelled'
}

/** Company subscription lapsed — only the workspace admin may open Billing and pay. */
export function orgNeedsPayment(org: {
  status: OrgStatus
  trial_ends_at: string | null
  current_period_end: string | null
}): boolean {
  if (org.status === 'past_due') return true
  if (org.status === 'trial' && org.trial_ends_at && new Date(org.trial_ends_at) < new Date()) return true
  if (org.status === 'active' && org.current_period_end && new Date(org.current_period_end) < new Date()) return true
  return false
}

export function orgAccessBlocked(org: {
  status: OrgStatus
  trial_ends_at: string | null
}): { blocked: boolean; reason: string | null } {
  if (orgHardBlocked(org)) {
    return { blocked: true, reason: 'This workspace is suspended. Contact support.' }
  }
  return { blocked: false, reason: null }
}

export function priceForInterval(plan: SubscriptionPlan, interval: 'month' | 'year'): number {
  return interval === 'year' ? plan.yearly_price_cents : plan.monthly_price_cents
}
