'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { applyChecklistToTactic, toggleTacticChecklistItem } from '@/lib/actions/ops'
import type { ChecklistTemplate, TacticChecklistItem } from '@/lib/workspace/rows'
import { useToast } from '@/lib/store/toast'

export function TacticChecklist({
  tacticId,
  items,
  templates,
  canApply,
}: {
  tacticId: string
  items: TacticChecklistItem[]
  templates: ChecklistTemplate[]
  canApply: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [pending, start] = useTransition()

  const done = items.filter((i) => i.completed).length

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-neutral-700">
          Checklist {items.length > 0 ? `(${done}/${items.length})` : ''}
        </h3>
        {canApply && templates.length > 0 && (
          <select
            className="h-8 max-w-[14rem] rounded border border-neutral-300 px-2 text-xs"
            defaultValue=""
            disabled={pending}
            onChange={(e) => {
              const id = e.target.value
              if (!id) return
              start(async () => {
                const res = await applyChecklistToTactic(tacticId, id)
                if (res.error) toast.error(res.error)
                else router.refresh()
              })
            }}
          >
            <option value="">{items.length ? 'Replace template…' : 'Apply template…'}</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-400">No checklist on this job yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={item.completed}
                  disabled={pending}
                  onChange={(e) => start(async () => {
                    await toggleTacticChecklistItem(item.id, e.target.checked)
                    router.refresh()
                  })}
                />
                <span className={item.completed ? 'text-neutral-400 line-through' : 'text-neutral-800'}>
                  {item.label}
                  {item.required && <span className="ml-1 text-[10px] uppercase text-neutral-400">required</span>}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
