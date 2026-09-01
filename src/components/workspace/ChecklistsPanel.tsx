'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { saveChecklistTemplate, setChecklistTemplateActive } from '@/lib/actions/workspace'
import type { ChecklistTemplate } from '@/lib/workspace/rows'
import { useToast } from '@/lib/store/toast'

export function ChecklistsPanel({ templates }: { templates: ChecklistTemplate[] }) {
  const router = useRouter()
  const toast = useToast()
  const [name, setName] = useState('')
  const [items, setItems] = useState<{ label: string; required: boolean }[]>([{ label: '', required: true }])
  const [pending, start] = useTransition()

  function add() {
    start(async () => {
      const res = await saveChecklistTemplate({ name, items })
      if (res.error) toast.error(res.error)
      else {
        setName('')
        setItems([{ label: '', required: true }])
        toast.success('Checklist saved')
        router.refresh()
      }
    })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-neutral-800">New template</h3>
        <Input label="Template name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Site close-out" />
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="h-9 flex-1 rounded border border-neutral-300 px-3 text-sm"
              placeholder={`Step ${i + 1}`}
              value={item.label}
              onChange={(e) => {
                const next = [...items]
                next[i] = { ...item, label: e.target.value }
                setItems(next)
              }}
            />
            <label className="flex items-center gap-1 text-xs text-neutral-500">
              <input
                type="checkbox"
                checked={item.required}
                onChange={(e) => {
                  const next = [...items]
                  next[i] = { ...item, required: e.target.checked }
                  setItems(next)
                }}
              />
              Req
            </label>
            <button
              type="button"
              className="text-neutral-400 hover:text-danger-600"
              onClick={() => setItems(items.filter((_, j) => j !== i))}
              aria-label="Remove step"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button variant="secondary" size="sm" type="button" onClick={() => setItems([...items, { label: '', required: true }])}>
          <Plus className="h-3.5 w-3.5" /> Add step
        </Button>
        <Button onClick={add} loading={pending} disabled={!name.trim()}>Save template</Button>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-neutral-800">Saved templates</h3>
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {templates.length === 0 && <li className="px-4 py-6 text-center text-sm text-neutral-400">No checklists yet.</li>}
          {templates.map((t) => (
            <li key={t.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`text-sm font-medium ${t.is_active ? 'text-neutral-800' : 'text-neutral-400 line-through'}`}>{t.name}</p>
                  <p className="mt-1 text-xs text-neutral-500">
                    {(t.items ?? []).map((i) => i.label).join(' · ') || 'No steps'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => start(async () => {
                    await setChecklistTemplateActive(t.id, !t.is_active)
                    router.refresh()
                  })}
                >
                  {t.is_active ? 'Hide' : 'Show'}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
