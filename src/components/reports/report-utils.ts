// Client-safe utilities — no 'use server', importable by client components

import { todayInTimezone } from '@/lib/utils/dates'
import { TIMEZONE_OPTIONS } from '@/lib/utils/timezones'

export function timezoneShortLabel(timeZone: string): string {
  const opt = TIMEZONE_OPTIONS.find((o) => o.value === timeZone)
  if (!opt) return timeZone
  return opt.label.split(' — ')[0] ?? timeZone
}

export function downloadCSV(
  filename: string,
  headers:  string[],
  rows:     (string | number | null | undefined)[][],
) {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [headers as (string | number | null | undefined)[], ...rows].map(
    row => row.map(escape).join(','),
  )
  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function fmtHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function fmtDecimalHours(minutes: number): string {
  return (minutes / 60).toFixed(1)
}

/** Snap any YYYY-MM-DD to the Monday of its ISO week. */
export function toMonday(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const day = d.getDay() // 0=Sun
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  return d.toISOString().split('T')[0]
}

export function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export function isoToday(timeZone?: string): string {
  if (timeZone) return todayInTimezone(timeZone)
  return new Date().toISOString().split('T')[0]
}

export function isoDaysAgo(n: number, timeZone?: string): string {
  const today = isoToday(timeZone)
  const d     = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().split('T')[0]
}

export function fmtDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
}

export function weekLabel(monday: string): string {
  const sunday = addDays(monday, 6)
  const fmt = (s: string) =>
    new Date(s + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(monday)} – ${fmt(sunday)}`
}

/** 7 ISO date strings starting from monday */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i))
}
