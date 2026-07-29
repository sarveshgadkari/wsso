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

interface TransitionContext {
  isCreator: boolean
  isAssignee: boolean
}

export function getAllowedNext(
  currentStatus: TacticStatus,
  role: string,
  ctx?: TransitionContext,
): TacticStatus[] {
  if (role === 'admin') {
    const map: Record<TacticStatus, TacticStatus[]> = {
      assigned:    ['in_progress'],
      in_progress: ['review'],
      review:      ['done', 'in_progress'],
      done:        ['archived'],
      archived:    [],
    }
    return map[currentStatus] ?? []
  }

  if (role === 'manager') {
    if (!ctx) return []
    if (ctx.isAssignee) {
      // Manager is the assigned employee — can work on it but NOT approve
      const map: Record<TacticStatus, TacticStatus[]> = {
        assigned:    ['in_progress'],
        in_progress: ['review'],
        review:      [],
        done:        [],
        archived:    [],
      }
      return map[currentStatus] ?? []
    }
    if (ctx.isCreator) {
      // Manager created this for someone on their team — can approve/reject/archive
      const map: Record<TacticStatus, TacticStatus[]> = {
        assigned:    [],
        in_progress: [],
        review:      ['done', 'in_progress'],
        done:        ['archived'],
        archived:    [],
      }
      return map[currentStatus] ?? []
    }
    // Another manager's work order — no transitions allowed
    return []
  }

  // employee / director — can only move work assigned to them
  if (!ctx?.isAssignee) return []
  const map: Record<TacticStatus, TacticStatus[]> = {
    assigned:    ['in_progress'],
    in_progress: ['review'],
    review:      [],
    done:        [],
    archived:    [],
  }
  return map[currentStatus] ?? []
}
