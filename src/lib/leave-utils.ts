import type { LeaveStatus } from '@/lib/types'

export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  pending:  'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
}

export const LEAVE_STATUS_VARIANT: Record<LeaveStatus, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'> = {
  pending:  'warning',
  approved: 'success',
  rejected: 'danger',
}
