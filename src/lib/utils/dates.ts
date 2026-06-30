// Server-side date helpers — plain functions, no timezone magic, ISO format throughout.

export function isoDate(d: Date = new Date()): string {
  return d.toISOString().split('T')[0]
}

export function startOfWeekISO(): string {
  const d = new Date()
  const day = d.getDay()                          // 0 = Sun
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1)) // roll back to Monday
  d.setHours(0, 0, 0, 0)
  return isoDate(d)
}

export function startOfMonthISO(): string {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return isoDate(d)
}

export function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d
}

export function last7Days(): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return isoDate(d)
  })
}

export function last30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    return isoDate(d)
  })
}

// Weekday short label for a YYYY-MM-DD string (avoids UTC vs local timezone issues)
export function dayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })
}

// Month+day label — "Jun 1"
export function monthDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
