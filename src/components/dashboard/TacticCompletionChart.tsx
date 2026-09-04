'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { useIsDark } from '@/components/theme/ThemeProvider'

export interface CompletionBar {
  label: string  // "Jun 1", "Jun 2", …
  date:  string  // YYYY-MM-DD
  count: number
}

interface Props {
  data:   CompletionBar[]
  title?: string
}

const TODAY = new Date().toISOString().split('T')[0]

export function TacticCompletionChart({ data, title = 'Completions — last 30 days' }: Props) {
  const max = Math.max(...data.map(d => d.count), 2)
  const dark = useIsDark()
  const axis = dark ? '#94a3b8' : '#64748b'
  const muted = dark ? '#64748b' : '#94a3b8'
  const cursor = dark ? '#1e293b' : '#f1f5f9'
  const border = dark ? '#334155' : '#e2e8f0'
  const tooltipBg = dark ? '#1e293b' : '#ffffff'
  const tooltipColor = dark ? '#f8fafc' : '#0f172a'

  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-neutral-800">{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: axis }}
            axisLine={false}
            tickLine={false}
            interval={4}
          />
          <YAxis
            domain={[0, max]}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: muted }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: cursor }}
            formatter={(v: number) => [v, 'Completed']}
            labelFormatter={(_label, payload) => payload?.[0]?.payload?.date ?? ''}
            contentStyle={{
              fontSize: 12,
              border: `1px solid ${border}`,
              borderRadius: 6,
              backgroundColor: tooltipBg,
              color: tooltipColor,
            }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map(entry => (
              <Cell
                key={entry.date}
                fill={entry.date === TODAY ? '#2563eb' : '#93c5fd'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
