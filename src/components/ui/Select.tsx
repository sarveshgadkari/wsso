import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  hint?: string
  placeholder?: string
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, hint, placeholder, children, id, ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="text-sm font-medium text-neutral-700">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={!!error}
            className={cn(
              'h-9 w-full appearance-none rounded border bg-white pl-3 pr-8 text-sm text-neutral-900',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
              'disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500',
              error
                ? 'border-danger-500 focus:ring-danger-500 focus:border-danger-500'
                : 'border-neutral-300',
              className,
            )}
            {...props}
          >
            {placeholder && (
              <option value="">{placeholder}</option>
            )}
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-2.5 h-4 w-4 text-neutral-400" />
        </div>
        {error && <p className="text-xs text-danger-500">{error}</p>}
        {!error && hint && <p className="text-xs text-neutral-500">{hint}</p>}
      </div>
    )
  }
)
Select.displayName = 'Select'
