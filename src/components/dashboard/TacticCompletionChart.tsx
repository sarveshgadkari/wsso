'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

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

  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-neutral-800">{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            interval={4}
          />
          <YAxis
            domain={[0, max]}
            allowDecimals={false}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            formatter={(v: number) => [v, 'Completed']}
            labelFormatter={(_label, payload) => payload?.[0]?.payload?.date ?? ''}
            contentStyle={{
              fontSize: 12,
              border: '1px solid #e2e8f0',
              borderRadius: 6,
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
