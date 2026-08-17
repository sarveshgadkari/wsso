import { requireProfile } from '@/lib/auth/session'
import { ConnectAiPanel } from '@/components/connect-ai/ConnectAiPanel'

export const metadata = { title: 'Connect AI — WSSO' }

export default async function ConnectAiPage() {
  await requireProfile()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Connect AI</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Link Workforce 2.0 or other AI agents to your WSSO account — no DevTools, no hunting for
          tokens.
        </p>
      </div>

      <ConnectAiPanel />
    </div>
  )
}
