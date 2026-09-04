'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  applyThemeClass,
  pathUsesAppTheme,
  readStoredTheme,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from '@/lib/theme'

interface ThemeContextValue {
  theme: ThemePreference
  setTheme: (theme: ThemePreference) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [theme, setThemeState] = useState<ThemePreference>('light')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const stored = readStoredTheme()
    setThemeState(stored)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    applyThemeClass(theme, pathname)
  }, [theme, pathname, ready])

  const setTheme = useCallback((next: ThemePreference) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* ignore private mode */
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next = current === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        /* ignore private mode */
      }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    return {
      theme: 'light' as ThemePreference,
      setTheme: () => undefined,
      toggleTheme: () => undefined,
      enabled: false,
    }
  }
  return { ...ctx, enabled: true }
}

export function useIsDark() {
  const { theme } = useTheme()
  const pathname = usePathname()
  return theme === 'dark' && pathUsesAppTheme(pathname)
}
