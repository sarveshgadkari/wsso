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

function partNumber(parts: Intl.DateTimeFormatPart[], type: string): number {
  const raw = parts.find((p) => p.type === type)?.value ?? '0'
  const n = Number(raw)
  if (type === 'hour' && n === 24) return 0
  return n
}

/** Offset (ms) such that utc + offset ≈ wall time in `timeZone`. */
function tzOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  const asUtc = Date.UTC(
    partNumber(parts, 'year'),
    partNumber(parts, 'month') - 1,
    partNumber(parts, 'day'),
    partNumber(parts, 'hour'),
    partNumber(parts, 'minute'),
    partNumber(parts, 'second'),
  )
  return asUtc - date.getTime()
}

/** UTC instant for a local civil time in an IANA timezone. */
export function zonedLocalToUtc(dateStr: string, timeZone: string, hour = 0, minute = 0, second = 0): Date {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const asUtc = Date.UTC(y, mo - 1, d, hour, minute, second)
  let date = new Date(asUtc)
  date = new Date(asUtc - tzOffsetMs(date, timeZone))
  date = new Date(asUtc - tzOffsetMs(date, timeZone))
  return date
}

export const MAX_WORK_MINUTES = 24 * 60

/** Local midnight (00:00) at the start of the calendar day after `dateStr`. */
export function nextMidnightISO(dateStr: string, timeZone: string): string {
  return zonedLocalToUtc(addCalendarDays(dateStr, 1), timeZone, 0, 0, 0).toISOString()
}

/**
 * Clock-out instant if they forget: local midnight after their work day,
 * never more than 24 hours after clock-in.
 */
export function autoClockOutAt(clockInAt: Date, logDate: string, timeZone: string): Date {
  const midnight = zonedLocalToUtc(addCalendarDays(logDate, 1), timeZone, 0, 0, 0)
  const max24 = new Date(clockInAt.getTime() + MAX_WORK_MINUTES * 60_000)
  const out = midnight.getTime() <= max24.getTime() ? midnight : max24
  if (out.getTime() <= clockInAt.getTime()) {
    return new Date(clockInAt.getTime() + 1000)
  }
  return out
}

export function isPastAutoClockOut(clockInAt: Date, logDate: string, timeZone: string, now = new Date()): boolean {
  return now.getTime() >= autoClockOutAt(clockInAt, logDate, timeZone).getTime()
}

/** Minutes worked, capped at local midnight and 24 hours. */
export function liveWorkedMinutes(
  log: {
    duration_minutes: number | null
    clock_out_at: string | null
    clock_in_at: string
    log_date: string | null
  },
  timeZone: string,
  now = new Date(),
): number {
  const start = new Date(log.clock_in_at)
  const cap = log.log_date
    ? autoClockOutAt(start, log.log_date, timeZone)
    : new Date(start.getTime() + MAX_WORK_MINUTES * 60_000)
  const rawEnd = log.clock_out_at ? new Date(log.clock_out_at) : now
  const end = new Date(Math.min(rawEnd.getTime(), cap.getTime(), now.getTime()))
  const minutes = Math.floor((end.getTime() - start.getTime()) / 60_000)
  return Math.min(MAX_WORK_MINUTES, Math.max(0, minutes))
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
  return zonedLocalToUtc(dateStr, timeZone, 23, 59, 59).toISOString()
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
