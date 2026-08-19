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
          Link Workforce 2.0 Custom MCP to your WSSO account with a 30-day token — copy Server ID,
          Command, and Args (no DevTools).
        </p>
      </div>

      <ConnectAiPanel />
    </div>
  )
}
