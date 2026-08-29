import type { Metadata } from 'next'
import { BrandLogo } from '@/components/brand/BrandLogo'

export const metadata: Metadata = {
  title: 'WSSO',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-12">
      <div className="mb-8 text-center">
        <BrandLogo size={120} priority />
      </div>

      <div className="w-full max-w-md rounded-xl border bg-white p-8 shadow-card">
        {children}
      </div>
    </div>
  )
}
