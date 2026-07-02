/** Supported employee timezones — extend as your org grows. */
export const TIMEZONE_OPTIONS = [
  { value: 'Asia/Kolkata',      label: 'IST — India (Asia/Kolkata)' },
  { value: 'America/Chicago',   label: 'CST — US Central (America/Chicago)' },
  { value: 'America/New_York',  label: 'EST — US Eastern (America/New_York)' },
  { value: 'America/Denver',    label: 'MST — US Mountain (America/Denver)' },
  { value: 'America/Los_Angeles', label: 'PST — US Pacific (America/Los_Angeles)' },
  { value: 'UTC',               label: 'UTC' },
] as const

export const TIMEZONE_VALUES = TIMEZONE_OPTIONS.map((o) => o.value)

export const DEFAULT_TIMEZONE = 'Asia/Kolkata'

export function isValidTimezone(tz: string): boolean {
  return (TIMEZONE_VALUES as readonly string[]).includes(tz)
}

export function resolveTimezone(tz: string | null | undefined): string {
  if (tz && isValidTimezone(tz)) return tz
  return DEFAULT_TIMEZONE
}

/** e.g. "IST", "CST", "EST" */
export function timezoneShortLabel(timeZone: string): string {
  const opt = TIMEZONE_OPTIONS.find((o) => o.value === timeZone)
  if (!opt) return timeZone
  return opt.label.split(' — ')[0] ?? timeZone
}

/** e.g. "IST — India (Asia/Kolkata)" */
export function timezoneDisplayLabel(timeZone: string): string {
  const opt = TIMEZONE_OPTIONS.find((o) => o.value === timeZone)
  return opt?.label ?? timeZone
}

/** Current clock time in the employee's timezone — e.g. "3:45 PM" */
export function formatTimeInTimezone(timeZone: string, date: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour:         'numeric',
      minute:       '2-digit',
      hour12:       true,
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(date)
  }
}
