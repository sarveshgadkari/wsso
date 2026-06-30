import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-neutral-700"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          aria-invalid={!!error}
          className={cn(
            'h-9 w-full rounded border bg-white px-3 text-sm text-neutral-900',
            'placeholder:text-neutral-400 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            'disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500',
            error
              ? 'border-danger-500 focus:ring-danger-500 focus:border-danger-500'
              : 'border-neutral-300',
            className,
          )}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-danger-500">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={`${inputId}-hint`} className="text-xs text-neutral-500">
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
