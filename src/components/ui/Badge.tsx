import { cn } from '@/lib/utils'

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'

const VARIANTS: Record<Variant, string> = {
  default: 'bg-neutral-100  text-neutral-700',
  success: 'bg-success-50   text-success-700',
  warning: 'bg-warning-50   text-warning-700',
  danger:  'bg-danger-50    text-danger-700',
  info:    'bg-primary-50   text-primary-700',
  purple:  'bg-purple-100   text-purple-700',
}

interface BadgeProps {
  children: React.ReactNode
  variant?: Variant
  className?: string
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span className={cn('badge', VARIANTS[variant], className)}>
      {children}
    </span>
  )
}
