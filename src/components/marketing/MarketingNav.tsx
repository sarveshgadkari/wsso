'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'

const LINKS = [
  { href: '/#about', label: 'About' },
  { href: '/#product', label: 'Platform' },
  { href: '/#pricing', label: 'Plans' },
  { href: '/#company', label: 'Company' },
]

export function MarketingNav({
  signupHref,
  signup,
}: {
  signupHref: string
  signup: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07070a]/90 backdrop-blur-md">
      <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-4">
        <div className="rounded-md bg-white px-2 py-1">
          <BrandLogo size={48} priority />
        </div>

        <nav className="hidden items-center gap-8 lg:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70 hover:text-gold-400"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/login"
            className="border border-white/25 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white hover:border-gold-400 hover:text-gold-400"
          >
            Sign in
          </Link>
          <Link
            href={signupHref}
            className="bg-gold-500 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-950 hover:bg-gold-400"
          >
            {signup ? 'Create a workspace' : 'WSSO Login'}
          </Link>
        </nav>

        <button
          type="button"
          className="p-2 text-white lg:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t border-white/10 bg-[#07070a] px-4 py-4 lg:hidden">
          <div className="flex flex-col gap-3">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/80"
                onClick={() => setOpen(false)}
              >
                {l.label}
              </a>
            ))}
            <Link href="/login" className="py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">
              Sign in
            </Link>
            <Link
              href={signupHref}
              className="mt-1 bg-gold-500 px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-950"
            >
              {signup ? 'Create a workspace' : 'WSSO Login'}
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
