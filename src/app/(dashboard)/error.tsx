'use client'

import { useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[WSSO dashboard error]', error.digest ?? error.message, error)
  }, [error])

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertCircle className="h-10 w-10 text-danger-500" />
      <div>
        <h2 className="text-lg font-semibold text-neutral-900">Something went wrong loading this page</h2>
        <p className="mt-2 max-w-md text-sm text-neutral-500">
          The app hit a server error while rendering. This often means a Supabase migration
          was not applied yet, or a Vercel environment variable is missing.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-neutral-400">
            Error digest: {error.digest}
          </p>
        )}
      </div>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  )
}
