'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const SIZE = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
} as const

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  size?: keyof typeof SIZE
  children: React.ReactNode
}

export function Dialog({ open, onClose, title, description, size = 'md', children }: DialogProps) {
  const overlayRef = React.useRef<HTMLDivElement>(null)

  // Keyboard dismiss
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Body scroll lock
  React.useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" aria-hidden />

      <div
        role="dialog"
        aria-modal
        aria-labelledby="dlg-title"
        className={cn(
          'relative flex w-full max-h-[min(90dvh,calc(100vh-2rem))] flex-col rounded-xl border border-neutral-200 bg-white shadow-xl',
          'animate-in fade-in zoom-in-95 duration-150',
          SIZE[size],
        )}
      >
        {/* Header */}
        <div className="flex shrink-0 items-start justify-between border-b border-neutral-200 px-5 py-4">
          <div>
            <h2 id="dlg-title" className="text-base font-semibold text-neutral-900">
              {title}
            </h2>
            {description && (
              <p className="mt-0.5 text-sm text-neutral-500">{description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="ml-4 shrink-0 rounded text-neutral-400 hover:text-neutral-600 transition-colors focus:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body — scroll when content exceeds viewport */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}

/** Sticky footer inside a Dialog — place at the bottom of children */
export function DialogFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-5 flex items-center justify-end gap-2 border-t border-neutral-100 bg-white px-5 pt-4 pb-1">
      {children}
    </div>
  )
}
