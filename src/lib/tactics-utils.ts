import type { TacticStatus, TacticPriority } from '@/lib/types'

export const STATUS_LABEL: Record<TacticStatus, string> = {
  assigned:    'Assigned',
  in_progress: 'In Progress',
  review:      'Review',
  done:        'Done',
  archived:    'Archived',
}

export const STATUS_VARIANT: Record<TacticStatus, 'default' | 'success' | 'warning' | 'danger' | 'info'> = {
  assigned:    'default',
  in_progress: 'warning',
  review:      'info',
  done:        'success',
  archived:    'default',
}

export const PRIORITY_LABEL: Record<TacticPriority, string> = {
  low:      'Low',
  medium:   'Medium',
  high:     'High',
  critical: 'Critical',
}

export const PRIORITY_VARIANT: Record<TacticPriority, 'default' | 'warning' | 'danger'> = {
  low:      'default',
  medium:   'default',
  high:     'warning',
  critical: 'danger',
}

export function getAllowedNext(currentStatus: TacticStatus, role: string): TacticStatus[] {
  if (role === 'admin' || role === 'manager') {
    const map: Record<TacticStatus, TacticStatus[]> = {
      assigned:    ['in_progress'],
      in_progress: ['review'],
      review:      ['done', 'in_progress'],
      done:        ['archived'],
      archived:    [],
    }
    return map[currentStatus] ?? []
  }
  // employee / director — can only move their own tactic forward
  const map: Record<TacticStatus, TacticStatus[]> = {
    assigned:    ['in_progress'],
    in_progress: ['review'],
    review:      [],
    done:        [],
    archived:    [],
  }
  return map[currentStatus] ?? []
}
