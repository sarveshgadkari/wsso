import Link from 'next/link'
import { Radio } from 'lucide-react'
import type { LiveWorker } from '@/lib/actions/ops'

export function WhoIsWorkingCard({ workers }: { workers: LiveWorker[] }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 border-b border-neutral-200 px-5 py-3">
        <Radio className="h-4 w-4 text-emerald-500" />
        <h3 className="text-sm font-semibold text-neutral-700">Who is working now</h3>
        <span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
          {workers.length}
        </span>
      </div>
      {workers.length === 0 ? (
        <p className="px-5 py-5 text-center text-sm text-neutral-400">Nobody is clocked in.</p>
      ) : (
        <ul className="divide-y divide-neutral-100">
          {workers.slice(0, 8).map((w) => (
            <li key={w.id} className="flex items-center justify-between px-5 py-2.5">
              <div>
                <p className="text-sm font-medium text-neutral-800">{w.full_name}</p>
                <p className="font-mono text-[11px] text-neutral-400">{w.employee_code}</p>
              </div>
              <span className="text-xs text-neutral-500">
                since {new Date(w.clock_in_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="border-t border-neutral-100 px-5 py-2 text-right">
        <Link href="/time/team" className="text-xs text-primary-600 hover:underline">Team time →</Link>
      </div>
    </div>
  )
}
