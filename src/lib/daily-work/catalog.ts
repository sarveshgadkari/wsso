export const WORKER_TYPES = [
  { value: 'direct', label: 'Direct employee' },
  { value: '1099', label: '1099' },
  { value: 'subcontractor', label: 'Subcontractor' },
] as const

export const DAILY_WORK_CATEGORIES = [
  { value: 'admin', label: 'Admin' },
  { value: 'operations', label: 'Operations' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'business_development', label: 'Business Development' },
  { value: 'sales', label: 'Sales' },
  { value: 'it', label: 'IT' },
  { value: 'product_development', label: 'Product Development' },
  { value: 'executive', label: 'Executive Time' },
] as const

export const PRODUCT_OPTIONS = [
  { value: 'wf2', label: 'WF2.0' },
  { value: 'wsso', label: 'WSSO' },
  { value: 'directory', label: 'Directory' },
  { value: 'other', label: 'Other' },
] as const

export const EXECUTIVE_ROLES = [
  { value: 'ceo', label: 'CEO' },
  { value: 'coo', label: 'COO' },
  { value: 'cto', label: 'CTO' },
  { value: 'cio', label: 'CIO' },
  { value: 'cmo', label: 'CMO' },
  { value: 'cfo', label: 'CFO' },
  { value: 'caio', label: 'CAIO' },
] as const

export type WorkerType = (typeof WORKER_TYPES)[number]['value']
export type DailyWorkCategory = (typeof DAILY_WORK_CATEGORIES)[number]['value']
export type ProductOption = (typeof PRODUCT_OPTIONS)[number]['value']
export type ExecutiveRole = (typeof EXECUTIVE_ROLES)[number]['value']

const labelOf = (rows: readonly { value: string; label: string }[], value: string | null | undefined) =>
  rows.find((row) => row.value === value)?.label ?? value ?? ''

export function workerTypeLabel(value: string | null | undefined) {
  return labelOf(WORKER_TYPES, value)
}

export function categoryLabel(value: string | null | undefined) {
  return labelOf(DAILY_WORK_CATEGORIES, value)
}

export function productLabel(value: string | null | undefined, detail?: string | null) {
  if (value === 'other') return detail?.trim() || 'Other'
  return labelOf(PRODUCT_OPTIONS, value)
}

export function executiveLabel(value: string | null | undefined) {
  return labelOf(EXECUTIVE_ROLES, value)
}

export function hoursBetween(start: string, end: string): number | null {
  const startMin = minutesOf(start)
  const endMin = minutesOf(end)
  if (startMin == null || endMin == null || endMin <= startMin) return null
  const hours = (endMin - startMin) / 60
  if (hours <= 0 || hours > 24) return null
  return Math.round(hours * 100) / 100
}

function minutesOf(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function formatClock(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 5)
}

export function isoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function currentMonthRange() {
  const now = new Date()
  return {
    from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}
