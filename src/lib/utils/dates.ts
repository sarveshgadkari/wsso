// Server-side date helpers — ISO YYYY-MM-DD throughout.
// Use *InTimezone helpers when boundaries must match an employee's local day.

import { DEFAULT_TIMEZONE } from '@/lib/utils/timezones'

const WEEKDAY: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
}

/** UTC calendar date — avoid for employee-facing "today" boundaries. */
export function isoDate(d: Date = new Date()): string {
  return d.toISOString().split('T')[0]
}

/** Local calendar date in an IANA timezone (en-CA → YYYY-MM-DD). */
export function todayInTimezone(timeZone: string, d: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year:  'numeric',
      month: '2-digit',
      day:   '2-digit',
    }).format(d)
  } catch {
    return isoDate(d)
  }
}

function weekdayInTimezone(timeZone: string, d: Date = new Date()): number {
  const short = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(d)
  return WEEKDAY[short] ?? 0
}

function subtractCalendarDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().split('T')[0]
}

export function addCalendarDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

/** Monday of the week containing `ref`, in the given timezone. */
export function startOfWeekInTimezone(timeZone: string, ref: Date = new Date()): string {
  const today = todayInTimezone(timeZone, ref)
  const dow   = weekdayInTimezone(timeZone, ref)
  const back  = dow === 0 ? 6 : dow - 1
  return subtractCalendarDays(today, back)
}

/** UTC instant for 23:59:59 on a calendar date in the given timezone. */
export function endOfDayISO(dateStr: string, timeZone: string): string {
  const [y, mo, da] = dateStr.split('-').map(Number)
  const startMs     = Date.UTC(y, mo - 1, da - 1, 0, 0, 0)
  const endMs       = Date.UTC(y, mo - 1, da + 2, 0, 0, 0)
  let lastMatch: Date | null = null

  for (let t = startMs; t < endMs; t += 60_000) {
    const dt = new Date(t)
    if (todayInTimezone(timeZone, dt) !== dateStr) continue

    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour:   '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(dt).map((p) => [p.type, p.value]),
    )

    if (parts.hour === '23' && parts.minute === '59') {
      lastMatch = dt
    }
  }

  if (lastMatch) {
    // Snap to :59 seconds within that minute
    return new Date(lastMatch.getTime() + 59_000).toISOString()
  }

  return `${dateStr}T23:59:59.000Z`
}

/** @deprecated Prefer startOfWeekInTimezone(profile.timezone) for employee views. */
export function startOfWeekISO(): string {
  return startOfWeekInTimezone(DEFAULT_TIMEZONE)
}

export function startOfMonthISO(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return isoDate(d)
}

/** First calendar day of the month containing `ref`, in the given timezone. */
export function startOfMonthInTimezone(timeZone: string, ref: Date = new Date()): string {
  const today = todayInTimezone(timeZone, ref)
  return `${today.slice(0, 7)}-01`
}

export function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

export function last7Days(fromDateStr?: string): string[] {
  const anchor = fromDateStr ?? todayInTimezone(DEFAULT_TIMEZONE)
  return Array.from({ length: 7 }, (_, i) => subtractCalendarDays(anchor, 6 - i))
}

export function last30Days(fromDateStr?: string): string[] {
  const anchor = fromDateStr ?? todayInTimezone(DEFAULT_TIMEZONE)
  return Array.from({ length: 30 }, (_, i) => subtractCalendarDays(anchor, 29 - i))
}

// Weekday short label for a YYYY-MM-DD string (avoids UTC vs local timezone issues)
export function dayLabel(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
}

// Month+day label — "Jun 1"
export function monthDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
