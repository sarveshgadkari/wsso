import { cn } from '@/lib/utils'

type Variant = 'default' | 'success' | 'warning' | 'danger'

const VALUE_CLS: Record<Variant, string> = {
  default: 'text-neutral-900',
  success: 'text-success-700',
  warning: 'text-warning-700',
  danger:  'text-danger-700',
}

const ICON_BG: Record<Variant, string> = {
  default: 'bg-neutral-100',
  success: 'bg-success-50',
  warning: 'bg-warning-50',
  danger:  'bg-danger-50',
}

const ICON_CLS: Record<Variant, string> = {
  default: 'text-neutral-400',
  success: 'text-success-600',
  warning: 'text-warning-600',
  danger:  'text-danger-600',
}

interface StatCardProps {
  label:   string
  value:   string | number
  sub?:    string
  variant?: Variant
  icon?:   React.ComponentType<{ className?: string }>
}

export function StatCard({ label, value, sub, variant = 'default', icon: Icon }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">{label}</p>
          <p className={cn('mt-1 text-2xl font-bold tabular-nums', VALUE_CLS[variant])}>
            {value}
          </p>
          {sub && <p className="mt-0.5 text-xs text-neutral-400">{sub}</p>}
        </div>

        {Icon && (
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', ICON_BG[variant])}>
            <Icon className={cn('h-5 w-5', ICON_CLS[variant])} />
          </div>
        )}
      </div>
    </div>
  )
}
