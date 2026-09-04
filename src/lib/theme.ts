export const THEME_STORAGE_KEY = 'wsso-theme'

export type ThemePreference = 'light' | 'dark'

const MARKETING_PATHS = new Set(['/', '/terms', '/privacy', '/refunds'])

export function pathUsesAppTheme(pathname: string): boolean {
  return !MARKETING_PATHS.has(pathname)
}

export function readStoredTheme(): ThemePreference {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyThemeClass(theme: ThemePreference, pathname?: string) {
  if (typeof document === 'undefined') return
  const allow = pathname ? pathUsesAppTheme(pathname) : pathUsesAppTheme(window.location.pathname)
  document.documentElement.classList.toggle('dark', allow && theme === 'dark')
}

/** Runs before paint so the dashboard does not flash white. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var p=location.pathname;if(p==='/'||p==='/terms'||p==='/privacy'||p==='/refunds')return;if(localStorage.getItem('${THEME_STORAGE_KEY}')==='dark')document.documentElement.classList.add('dark');}catch(e){}})();`
