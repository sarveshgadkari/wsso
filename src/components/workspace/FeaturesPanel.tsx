'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { saveWorkspaceSettings } from '@/lib/actions/workspace'
import { FEATURE_LABELS, type WorkspaceFeatureKey, type WorkspaceSettings } from '@/lib/workspace/settings'
import { useToast } from '@/lib/store/toast'

export function FeaturesPanel({ settings }: { settings: WorkspaceSettings }) {
  const router = useRouter()
  const toast = useToast()
  const [features, setFeatures] = useState(settings.features)
  const [pending, start] = useTransition()

  function toggle(key: WorkspaceFeatureKey) {
    setFeatures((f) => ({ ...f, [key]: !f[key] }))
  }

  function save() {
    start(async () => {
      const res = await saveWorkspaceSettings({ features })
      if (res.error) toast.error(res.error)
      else {
        toast.success('Features saved — menus update for everyone in this workspace')
        router.refresh()
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-neutral-500">
        Turn modules on or off for this workspace. Hidden items leave the sidebar so each company only sees what they use.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {FEATURE_LABELS.map((item) => (
          <label
            key={item.key}
            className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3"
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-neutral-300 text-primary-600"
              checked={features[item.key]}
              onChange={() => toggle(item.key)}
            />
            <span>
              <span className="block text-sm font-medium text-neutral-800">{item.label}</span>
              <span className="block text-xs text-neutral-500">{item.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <div>
        <Button onClick={save} loading={pending}>Save features</Button>
      </div>
    </div>
  )
}
