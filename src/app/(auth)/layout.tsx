import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'WSSO',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 py-12">
      {/* Brand mark */}
      <div className="mb-8 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold text-white shadow">
          W
        </span>
        <p className="mt-2 text-sm font-semibold tracking-widest text-neutral-400 uppercase">
          WSSO
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-xl border bg-white p-8 shadow-card">
        {children}
      </div>
    </div>
  )
}
