'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Check, ClipboardCheck, Download, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/lib/store/toast'
import { downloadCSV } from '@/components/reports/report-utils'
import {
  createDailyWork,
  deleteDailyWork,
  setDailyWorkStatus,
  updateDailyWork,
  type DailyWorkInput,
  type DailyWorkRow,
} from '@/lib/actions/daily-work'
import {
  DAILY_WORK_CATEGORIES,
  EXECUTIVE_ROLES,
  PRODUCT_OPTIONS,
  WORKER_TYPES,
  categoryLabel,
  executiveLabel,
  formatClock,
  hoursBetween,
  productLabel,
  workerTypeLabel,
} from '@/lib/daily-work/catalog'
import type { UserRole } from '@/lib/types'

type Tab = 'mine' | 'review' | 'report'

interface Props {
  viewerRole: UserRole
  from: string
  to: string
  mine: DailyWorkRow[]
  review: DailyWorkRow[]
  missingTable: boolean
}

const emptyForm = (today: string): DailyWorkInput => ({
  work_date: today,
  worker_type: 'direct',
  category: 'operations',
  product: null,
  product_detail: '',
  executive_role: null,
  task: '',
  start_time: '09:00',
  end_time: '10:00',
  notes: '',
})

export function DailyWorkShell({ viewerRole, from, to, mine, review, missingTable }: Props) {
  const toast = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>('mine')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<DailyWorkInput>(() => emptyForm(to))
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'done'>('submitted')
  const [rangeFrom, setRangeFrom] = useState(from)
  const [rangeTo, setRangeTo] = useState(to)

  const isAdmin = viewerRole === 'admin'
  const canReview = viewerRole === 'admin' || viewerRole === 'manager'
  const previewHours = hoursBetween(form.start_time, form.end_time)

  const reviewRows = useMemo(() => {
    if (statusFilter === 'all') return review
    return review.filter((row) => row.status === statusFilter)
  }, [review, statusFilter])

  const setField = <K extends keyof DailyWorkInput>(key: K, value: DailyWorkInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const save = () => {
    startTransition(async () => {
      const result = editingId
        ? await updateDailyWork(editingId, form)
        : await createDailyWork(form)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success(editingId ? 'Daily work updated' : 'Daily work submitted')
      setEditingId(null)
      setForm(emptyForm(to))
      router.refresh()
    })
  }

  const beginEdit = (row: DailyWorkRow) => {
    setTab('mine')
    setEditingId(row.id)
    setForm({
      work_date: row.work_date,
      worker_type: row.worker_type,
      category: row.category,
      product: row.product,
      product_detail: row.product_detail ?? '',
      executive_role: row.executive_role,
      task: row.task,
      start_time: formatClock(row.start_time),
      end_time: formatClock(row.end_time),
      notes: row.notes ?? '',
    })
  }

  if (missingTable) {
    return (
      <div className="card max-w-xl p-6">
        <h2 className="text-lg font-semibold text-neutral-900">Daily Work needs a database update</h2>
        <p className="mt-2 text-sm text-neutral-600">
          Open the Supabase SQL editor and run <span className="font-mono">saas/13_daily_work.sql</span>, then reload this page.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">Daily Work</h2>
        <p className="mt-1 max-w-3xl text-sm text-neutral-500">
          Log the task, the category, and the exact time. This is the general time record for direct employees, 1099 contractors, and subcontractors.
          Employees see only their own entries. Managers review the employees under them. Admins see every entry, review managers, and run the report.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Input label="From" type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
        <Input label="To" type="date" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(`/daily-work?from=${rangeFrom}&to=${rangeTo}`)}
        >
          Apply dates
        </Button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')} label="My work" />
        {canReview && (
          <TabButton active={tab === 'review'} onClick={() => setTab('review')} label={isAdmin ? 'Everyone' : 'My team'} />
        )}
        {isAdmin && (
          <TabButton active={tab === 'report'} onClick={() => setTab('report')} label="Report" />
        )}
      </div>

      {tab === 'mine' && (
        <>
          <form
            className="card grid gap-4 p-5 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <div className="md:col-span-2">
              <h3 className="text-sm font-semibold text-neutral-800">
                {editingId ? 'Edit submitted work' : 'Add today\'s work'}
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                Showing {from} to {to}. Submitted work can still be edited. Once it is marked done, it is locked.
              </p>
            </div>
            <Input label="Date" type="date" value={form.work_date} onChange={(e) => setField('work_date', e.target.value)} required />
            <Select label="Who this time is for" value={form.worker_type} onChange={(e) => setField('worker_type', e.target.value)}>
              {WORKER_TYPES.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
            </Select>
            <Select label="Category" value={form.category} onChange={(e) => setField('category', e.target.value)}>
              {DAILY_WORK_CATEGORIES.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
            </Select>
            {form.category === 'product_development' && (
              <Select label="Product" value={form.product ?? ''} onChange={(e) => setField('product', e.target.value || null)}>
                <option value="">Choose a product</option>
                {PRODUCT_OPTIONS.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
              </Select>
            )}
            {form.category === 'product_development' && form.product === 'other' && (
              <Input label="Product name" value={form.product_detail ?? ''} onChange={(e) => setField('product_detail', e.target.value)} />
            )}
            {form.category === 'executive' && (
              <Select label="Executive role" value={form.executive_role ?? ''} onChange={(e) => setField('executive_role', e.target.value || null)}>
                <option value="">Choose a role</option>
                {EXECUTIVE_ROLES.map((row) => <option key={row.value} value={row.value}>{row.label}</option>)}
              </Select>
            )}
            <Input label="Start" type="time" value={form.start_time} onChange={(e) => setField('start_time', e.target.value)} required />
            <Input label="End" type="time" value={form.end_time} onChange={(e) => setField('end_time', e.target.value)} required />
            <div className="md:col-span-2">
              <Input label="Task" value={form.task} onChange={(e) => setField('task', e.target.value)} placeholder="What was done" required />
            </div>
            <div className="md:col-span-2">
              <Input label="Notes" value={form.notes ?? ''} onChange={(e) => setField('notes', e.target.value)} placeholder="Optional" />
            </div>
            <div className="flex items-center justify-between gap-3 md:col-span-2">
              <p className="text-sm text-neutral-600">
                Time logged: <span className="font-semibold text-neutral-900">{previewHours == null ? '—' : `${previewHours.toFixed(2)} h`}</span>
              </p>
              <div className="flex gap-2">
                {editingId && (
                  <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setForm(emptyForm(to)) }}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" loading={pending} disabled={previewHours == null}>
                  {editingId ? 'Save changes' : 'Submit work'}
                </Button>
              </div>
            </div>
          </form>
          <EntryTable
            rows={mine}
            pending={pending}
            onEdit={beginEdit}
            onDelete={(id) => startTransition(async () => {
              const result = await deleteDailyWork(id)
              if (result.error) toast.error(result.error)
              else {
                toast.success('Entry removed')
                router.refresh()
              }
            })}
          />
        </>
      )}

      {tab === 'review' && canReview && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-neutral-500">
              {isAdmin
                ? 'You can mark any entry done, including managers. Managers cannot review other managers.'
                : 'You can mark work done only for employees under you.'}
            </p>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="w-40">
              <option value="submitted">Waiting</option>
              <option value="done">Done</option>
              <option value="all">All</option>
            </Select>
          </div>
          <ReviewTable
            rows={reviewRows}
            isAdmin={isAdmin}
            pending={pending}
            onStatus={(id, status) => startTransition(async () => {
              const result = await setDailyWorkStatus(id, status)
              if (result.error) toast.error(result.error)
              else {
                toast.success(status === 'done' ? 'Marked done' : 'Reopened')
                router.refresh()
              }
            })}
          />
        </div>
      )}

      {tab === 'report' && isAdmin && (
        <ReportPanel rows={review} from={from} to={to} />
      )}
    </div>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm font-medium ${active ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-800'}`}
    >
      {label}
    </button>
  )
}

function detailOf(row: DailyWorkRow) {
  if (row.category === 'product_development') return productLabel(row.product, row.product_detail)
  if (row.category === 'executive') return executiveLabel(row.executive_role)
  return '—'
}

function EntryTable({
  rows,
  pending,
  onEdit,
  onDelete,
}: {
  rows: DailyWorkRow[]
  pending: boolean
  onEdit: (row: DailyWorkRow) => void
  onDelete: (id: string) => void
}) {
  if (!rows.length) {
    return <div className="card px-5 py-10 text-center text-sm text-neutral-500">No daily work in this range yet.</div>
  }
  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-400">
          <tr>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Detail</th>
            <th className="px-4 py-3 font-medium">Task</th>
            <th className="px-4 py-3 font-medium">Time</th>
            <th className="px-4 py-3 font-medium">Hours</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-neutral-100 last:border-0">
              <td className="px-4 py-3 whitespace-nowrap">{row.work_date}</td>
              <td className="px-4 py-3">{categoryLabel(row.category)}<div className="text-xs text-neutral-400">{workerTypeLabel(row.worker_type)}</div></td>
              <td className="px-4 py-3">{detailOf(row)}</td>
              <td className="px-4 py-3 max-w-xs">{row.task}</td>
              <td className="px-4 py-3 whitespace-nowrap">{formatClock(row.start_time)}–{formatClock(row.end_time)}</td>
              <td className="px-4 py-3 tabular-nums">{Number(row.hours).toFixed(2)}</td>
              <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
              <td className="px-4 py-3">
                {row.status === 'submitted' && (
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(row)}><Pencil className="h-3.5 w-3.5" />Edit</Button>
                    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => onDelete(row.id)}><Trash2 className="h-3.5 w-3.5" />Delete</Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ReviewTable({
  rows,
  isAdmin,
  pending,
  onStatus,
}: {
  rows: DailyWorkRow[]
  isAdmin: boolean
  pending: boolean
  onStatus: (id: string, status: 'submitted' | 'done') => void
}) {
  if (!rows.length) {
    return <div className="card px-5 py-10 text-center text-sm text-neutral-500">Nothing to review in this range.</div>
  }
  return (
    <div className="card overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-neutral-200 text-xs uppercase tracking-wide text-neutral-400">
          <tr>
            <th className="px-4 py-3 font-medium">Person</th>
            <th className="px-4 py-3 font-medium">Date</th>
            <th className="px-4 py-3 font-medium">Category</th>
            <th className="px-4 py-3 font-medium">Task</th>
            <th className="px-4 py-3 font-medium">Hours</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const person = row.employee
            const leadership = person && person.role !== 'employee'
            return (
              <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium text-neutral-900">{person?.full_name ?? 'Unknown'}</p>
                  <p className="text-xs capitalize text-neutral-400">{person?.role?.replace('_', ' ')} · {person?.employee_code}</p>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{row.work_date}<div className="text-xs text-neutral-400">{formatClock(row.start_time)}–{formatClock(row.end_time)}</div></td>
                <td className="px-4 py-3">{categoryLabel(row.category)}<div className="text-xs text-neutral-400">{detailOf(row)} · {workerTypeLabel(row.worker_type)}</div></td>
                <td className="px-4 py-3 max-w-xs">{row.task}</td>
                <td className="px-4 py-3 tabular-nums">{Number(row.hours).toFixed(2)}</td>
                <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                <td className="px-4 py-3 text-right">
                  {row.status === 'submitted' && (isAdmin || !leadership) && (
                    <Button type="button" size="sm" disabled={pending} onClick={() => onStatus(row.id, 'done')}>
                      <Check className="h-3.5 w-3.5" />
                      Mark done
                    </Button>
                  )}
                  {row.status === 'done' && isAdmin && (
                    <Button type="button" variant="secondary" size="sm" disabled={pending} onClick={() => onStatus(row.id, 'submitted')}>
                      <RotateCcw className="h-3.5 w-3.5" />Reopen
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return status === 'done'
    ? <Badge variant="success">Done</Badge>
    : <Badge variant="warning">Submitted</Badge>
}

function ReportPanel({ rows, from, to }: { rows: DailyWorkRow[]; from: string; to: string }) {
  const byCategory = useMemo(() => sumBy(rows, (row) => categoryLabel(row.category)), [rows])
  const byPerson = useMemo(() => sumBy(rows, (row) => row.employee?.full_name ?? 'Unknown'), [rows])
  const totalHours = rows.reduce((sum, row) => sum + Number(row.hours), 0)
  const done = rows.filter((row) => row.status === 'done').length

  const exportCsv = () => {
    downloadCSV(
      `daily-work-${from}-to-${to}.csv`,
      ['Date', 'Name', 'Code', 'Role', 'Worker type', 'Category', 'Detail', 'Task', 'Start', 'End', 'Hours', 'Status', 'Notes'],
      rows.map((row) => [
        row.work_date,
        row.employee?.full_name,
        row.employee?.employee_code,
        row.employee?.role,
        workerTypeLabel(row.worker_type),
        categoryLabel(row.category),
        detailOf(row),
        row.task,
        formatClock(row.start_time),
        formatClock(row.end_time),
        Number(row.hours).toFixed(2),
        row.status,
        row.notes,
      ]),
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Hours" value={totalHours.toFixed(2)} />
          <Stat label="Entries" value={String(rows.length)} />
          <Stat label="Marked done" value={String(done)} />
          <Stat label="Waiting" value={String(rows.length - done)} />
        </div>
        <Button type="button" variant="secondary" onClick={exportCsv}>
          <Download className="h-4 w-4" />Export CSV
        </Button>
      </div>

      <div id="daily-work-detail" className="grid gap-4 lg:grid-cols-2">
        <HoursChart title="Hours by category" data={byCategory} />
        <HoursChart title="Hours by person" data={byPerson} />
      </div>

      <div className="card overflow-x-auto">
        <div className="flex items-center gap-2 border-b border-neutral-200 px-4 py-3">
          <ClipboardCheck className="h-4 w-4 text-neutral-400" />
          <h3 className="text-sm font-semibold text-neutral-800">Detail</h3>
        </div>
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-neutral-400">
            <tr>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Hours</th>
              <th className="px-4 py-3 font-medium">Entries</th>
              <th className="px-4 py-3 font-medium">Done</th>
            </tr>
          </thead>
          <tbody>
            {byCategory.map((row) => (
              <tr key={row.name} className="border-t border-neutral-100">
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3 tabular-nums">{row.hours.toFixed(2)}</td>
                <td className="px-4 py-3">{row.count}</td>
                <td className="px-4 py-3">{row.done}</td>
              </tr>
            ))}
            {!byCategory.length && (
              <tr><td className="px-4 py-8 text-neutral-500" colSpan={4}>No daily work in {from} to {to}.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-neutral-900">{value}</p>
    </div>
  )
}

function HoursChart({ title, data }: { title: string; data: { name: string; hours: number }[] }) {
  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-neutral-800">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-neutral-500">No hours in this range.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 24 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-25} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 11 }} width={32} />
            <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} h`, 'Hours']} />
            <Bar dataKey="hours" fill="#0f766e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}

function sumBy(rows: DailyWorkRow[], keyOf: (row: DailyWorkRow) => string) {
  const map = new Map<string, { name: string; hours: number; count: number; done: number }>()
  for (const row of rows) {
    const name = keyOf(row)
    const current = map.get(name) ?? { name, hours: 0, count: 0, done: 0 }
    current.hours += Number(row.hours)
    current.count += 1
    if (row.status === 'done') current.done += 1
    map.set(name, current)
  }
  return Array.from(map.values()).sort((a, b) => b.hours - a.hours)
}
