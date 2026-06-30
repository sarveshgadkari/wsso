'use client'

import { CheckCircle, XCircle, Info, X } from 'lucide-react'
import { useToastStore } from '@/lib/store/toast'
import { cn } from '@/lib/utils'

const CONFIG = {
  success: { icon: CheckCircle, classes: 'bg-success-50  border-success-500/40 text-success-800' },
  error:   { icon: XCircle,     classes: 'bg-danger-50   border-danger-500/40  text-danger-800'  },
  info:    { icon: Info,        classes: 'bg-primary-50  border-primary-500/40 text-primary-800' },
} as const

/** Mount this once inside the dashboard layout — it renders the live toast stack */
export function ToastContainer() {
  const { toasts, remove } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div
      aria-live="polite"
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2"
    >
      {toasts.map((toast) => {
        const { icon: Icon, classes } = CONFIG[toast.type]
        return (
          <div
            key={toast.id}
            className={cn(
              'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg',
              'min-w-[280px] max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-200',
              classes,
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 text-sm font-medium">{toast.message}</p>
            <button
              onClick={() => remove(toast.id)}
              className="ml-1 shrink-0 rounded opacity-60 hover:opacity-100 focus:outline-none"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
