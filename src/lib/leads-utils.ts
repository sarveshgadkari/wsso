import type { LeadStatus } from '@/lib/types'

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new:       'New',
  contacted: 'Contacted',
  qualified: 'Qualified',
  converted: 'Converted',
  lost:      'Lost',
}

export const LEAD_STATUS_VARIANT: Record<LeadStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'> = {
  new:       'info',
  contacted: 'warning',
  qualified: 'purple',
  converted: 'success',
  lost:      'danger',
}
