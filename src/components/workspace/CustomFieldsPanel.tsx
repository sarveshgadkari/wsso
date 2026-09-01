'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { saveFieldDefinition, setFieldDefinitionActive } from '@/lib/actions/workspace'
import { CUSTOM_FIELD_ENTITIES, type CustomFieldEntity, type CustomFieldType } from '@/lib/workspace/settings'
import type { CustomFieldDefinition } from '@/lib/workspace/rows'
import { useToast } from '@/lib/store/toast'

export function CustomFieldsPanel({ fields }: { fields: CustomFieldDefinition[] }) {
  const router = useRouter()
  const toast = useToast()
  const [entity, setEntity] = useState<CustomFieldEntity>('employee')
  const [label, setLabel] = useState('')
  const [fieldType, setFieldType] = useState<CustomFieldType>('text')
  const [options, setOptions] = useState('')
  const [required, setRequired] = useState(false)
  const [pending, start] = useTransition()

  const filtered = useMemo(() => fields.filter((f) => f.entity_type === entity), [fields, entity])

  function add() {
    start(async () => {
      const res = await saveFieldDefinition({
        entity_type: entity,
        label,
        field_type: fieldType,
        options: options.split(',').map((s) => s.trim()).filter(Boolean),
        required,
      })
      if (res.error) toast.error(res.error)
      else {
        setLabel('')
        setOptions('')
        toast.success('Field added')
        router.refresh()
      }
    })
  }

  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <p className="text-sm text-neutral-500">
        Extra fields per company — site code, truck number, crop type — without asking us to customize the product.
      </p>
      <select
        value={entity}
        onChange={(e) => setEntity(e.target.value as CustomFieldEntity)}
        className="h-9 max-w-xs rounded border border-neutral-300 bg-white px-3 text-sm"
      >
        {CUSTOM_FIELD_ENTITIES.map((e) => (
          <option key={e.type} value={e.type}>{e.label}</option>
        ))}
      </select>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Field label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-neutral-700">Type</label>
          <select
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as CustomFieldType)}
            className="h-9 rounded border border-neutral-300 bg-white px-3 text-sm"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="select">Dropdown</option>
            <option value="boolean">Yes / no</option>
          </select>
        </div>
      </div>
      {fieldType === 'select' && (
        <Input
          label="Dropdown options (comma-separated)"
          value={options}
          onChange={(e) => setOptions(e.target.value)}
          hint="Example: North, South, Warehouse"
        />
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        Required
      </label>
      <Button onClick={add} loading={pending} disabled={!label.trim()}>Add field</Button>

      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
        {filtered.length === 0 && <li className="px-4 py-6 text-center text-sm text-neutral-400">No custom fields on this record type.</li>}
        {filtered.map((f) => (
          <li key={f.id} className="flex items-center justify-between px-4 py-2.5">
            <div>
              <p className={`text-sm ${f.is_active ? 'text-neutral-800' : 'text-neutral-400 line-through'}`}>{f.label}</p>
              <p className="text-xs text-neutral-400">{f.field_type}{f.required ? ' · required' : ''}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => start(async () => {
                await setFieldDefinitionActive(f.id, !f.is_active)
                router.refresh()
              })}
            >
              {f.is_active ? 'Hide' : 'Show'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
