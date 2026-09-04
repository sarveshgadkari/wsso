import { NAV_SECTIONS } from '@/lib/nav'

export type StickyNoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange'

export const STICKY_NOTE_COLORS: {
  id: StickyNoteColor
  label: string
  paper: string
  ink: string
}[] = [
  { id: 'yellow', label: 'Yellow', paper: '#fde68a', ink: '#78350f' },
  { id: 'pink',   label: 'Pink',   paper: '#fbcfe8', ink: '#9d174d' },
  { id: 'blue',   label: 'Blue',   paper: '#bfdbfe', ink: '#1e3a8a' },
  { id: 'green',  label: 'Green',  paper: '#bbf7d0', ink: '#14532d' },
  { id: 'orange', label: 'Orange', paper: '#fed7aa', ink: '#9a3412' },
]

export function stickyNotePaper(color: string): { paper: string; ink: string } {
  return STICKY_NOTE_COLORS.find((c) => c.id === color) ?? STICKY_NOTE_COLORS[0]
}

const EXTRA_PAGES: { path: string; label: string }[] = [
  { path: '/settings/billing',   label: 'Subscription' },
  { path: '/settings/workspace', label: 'Workspace' },
]

export function stickyNotePageList(): { path: string; label: string }[] {
  const fromNav = NAV_SECTIONS.flatMap((section) =>
    section.items.map((item) => ({ path: item.href, label: item.label })),
  )
  const all = [...fromNav, ...EXTRA_PAGES]
  const seen = new Set<string>()
  return all.filter((p) => {
    if (seen.has(p.path)) return false
    seen.add(p.path)
    return true
  })
}

/** Match a URL to the dashboard tab it belongs to (longest prefix wins). */
export function resolveStickyNotePage(pathname: string): { path: string; label: string } {
  const pages = stickyNotePageList().sort((a, b) => b.path.length - a.path.length)
  const match = pages.find(
    (p) => pathname === p.path || pathname.startsWith(`${p.path}/`),
  )
  return match ?? { path: pathname || '/dashboard', label: 'Dashboard' }
}
