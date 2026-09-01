'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { saveCatalogItem, setCatalogItemActive } from '@/lib/actions/workspace'
import { CATALOG_KINDS, type CatalogKind } from '@/lib/workspace/settings'
import type { OrgCatalogItem } from '@/lib/workspace/rows'
import { useToast } from '@/lib/store/toast'

export function CatalogPanel({ items }: { items: OrgCatalogItem[] }) {
  const router = useRouter()
  const toast = useToast()
  const [kind, setKind] = useState<CatalogKind>('leave_type')
  const [label, setLabel] = useState('')
  const [paid, setPaid] = useState(true)
  const [pending, start] = useTransition()

  const filtered = useMemo(() => items.filter((i) => i.kind === kind), [items, kind])
  const meta = CATALOG_KINDS.find((k) => k.kind === kind)

  function add() {
    start(async () => {
      const res = await saveCatalogItem({ kind, label, paid })
      if (res.error) toast.error(res.error)
      else {
        setLabel('')
        toast.success('Added')
        router.refresh()
      }
    })
  }

  function toggle(id: string, is_active: boolean) {
    start(async () => {
      const res = await setCatalogItemActive(id, is_active)
      if (res.error) toast.error(res.error)
      else router.refresh()
    })
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-sm text-neutral-500">
        These lists are yours. Change them anytime — leave forms, CRM win/lost, job types, and skills all read from here.
      </p>
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as CatalogKind)}
        className="h-9 max-w-xs rounded border border-neutral-300 bg-white px-3 text-sm"
      >
        {CATALOG_KINDS.map((k) => (
          <option key={k.kind} value={k.kind}>{k.label}</option>
        ))}
      </select>
      {meta && <p className="text-xs text-neutral-500">{meta.hint}</p>}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[180px] flex-1">
          <Input label="New item" value={label} onChange={(e) => setLabel(e.target.value)} />
        </div>
        {kind === 'leave_type' && (
          <label className="mb-1 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} />
            Paid
          </label>
        )}
        <Button onClick={add} loading={pending} disabled={!label.trim()}>Add</Button>
      </div>

      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {filtered.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-neutral-400">Nothing in this list yet.</li>
        )}
        {filtered.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
            <div>
              <p className={`text-sm ${item.is_active ? 'text-neutral-800' : 'text-neutral-400 line-through'}`}>
                {item.label}
              </p>
              {item.kind === 'leave_type' && (
                <p className="text-xs text-neutral-400">{item.meta?.paid === false ? 'Unpaid' : 'Paid'}</p>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => toggle(item.id, !item.is_active)} disabled={pending}>
              {item.is_active ? 'Hide' : 'Show'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
