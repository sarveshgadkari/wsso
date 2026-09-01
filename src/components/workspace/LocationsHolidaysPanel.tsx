'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { deleteHoliday, saveHoliday, saveLocation, setLocationActive } from '@/lib/actions/workspace'
import type { OrgHoliday, OrgLocation } from '@/lib/workspace/rows'
import { useToast } from '@/lib/store/toast'

export function LocationsHolidaysPanel({
  locations,
  holidays,
}: {
  locations: OrgLocation[]
  holidays: OrgHoliday[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [locName, setLocName] = useState('')
  const [locAddress, setLocAddress] = useState('')
  const [hName, setHName] = useState('')
  const [hDate, setHDate] = useState('')
  const [hPaid, setHPaid] = useState(true)
  const [pending, start] = useTransition()

  function addLoc() {
    start(async () => {
      const res = await saveLocation({ name: locName, address: locAddress })
      if (res.error) toast.error(res.error)
      else {
        setLocName('')
        setLocAddress('')
        toast.success('Location added')
        router.refresh()
      }
    })
  }

  function addHoliday() {
    start(async () => {
      const res = await saveHoliday({ name: hName, holiday_on: hDate, is_paid: hPaid })
      if (res.error) toast.error(res.error)
      else {
        setHName('')
        setHDate('')
        toast.success('Holiday added')
        router.refresh()
      }
    })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-neutral-800">Branches / sites</h3>
        <p className="text-xs text-neutral-500">Assign people and jobs to a location. Optional.</p>
        <Input label="Name" value={locName} onChange={(e) => setLocName(e.target.value)} />
        <Input label="Address" value={locAddress} onChange={(e) => setLocAddress(e.target.value)} />
        <Button onClick={addLoc} loading={pending} disabled={!locName.trim()}>Add location</Button>
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {locations.length === 0 && <li className="px-4 py-5 text-center text-sm text-neutral-400">No locations yet.</li>}
          {locations.map((l) => (
            <li key={l.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className={`text-sm ${l.is_active ? 'text-neutral-800' : 'text-neutral-400 line-through'}`}>{l.name}</p>
                {l.address && <p className="text-xs text-neutral-400">{l.address}</p>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => start(async () => {
                  await setLocationActive(l.id, !l.is_active)
                  router.refresh()
                })}
              >
                {l.is_active ? 'Hide' : 'Show'}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-neutral-800">Company holidays</h3>
        <p className="text-xs text-neutral-500">Shown against leave and timesheets. Add your floating days here.</p>
        <Input label="Name" value={hName} onChange={(e) => setHName(e.target.value)} />
        <Input label="Date" type="date" value={hDate} onChange={(e) => setHDate(e.target.value)} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hPaid} onChange={(e) => setHPaid(e.target.checked)} />
          Paid holiday
        </label>
        <Button onClick={addHoliday} loading={pending} disabled={!hName.trim() || !hDate}>Add holiday</Button>
        <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 bg-white">
          {holidays.length === 0 && <li className="px-4 py-5 text-center text-sm text-neutral-400">No holidays yet.</li>}
          {holidays.map((h) => (
            <li key={h.id} className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-sm text-neutral-800">{h.name}</p>
                <p className="text-xs text-neutral-400">{h.holiday_on} · {h.is_paid ? 'Paid' : 'Unpaid'}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-danger-600"
                disabled={pending}
                onClick={() => start(async () => {
                  await deleteHoliday(h.id)
                  router.refresh()
                })}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
