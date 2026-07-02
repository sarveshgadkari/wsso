import { create } from 'zustand'
import { useMemo } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastStore {
  toasts: Toast[]
  add:    (type: ToastType, message: string) => void
  remove: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],

  add(type, message) {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }))
    // Auto-dismiss after 4 s
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  },

  remove(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

/** Convenience hook — call inside any Client Component */
export function useToast() {
  const add = useToastStore((s) => s.add)
  return useMemo(
    () => ({
      success: (msg: string) => add('success', msg),
      error:   (msg: string) => add('error', msg),
      info:    (msg: string) => add('info', msg),
    }),
    [add],
  )
}
