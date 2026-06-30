'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

export interface DayBar {
  label: string   // 'Mon', 'Tue', …
  date:  string   // YYYY-MM-DD (for tooltip)
  hours: number
}

interface Props {
  data:  DayBar[]
  title?: string
}

const TODAY_LABEL = new Date().toLocaleDateString('en-US', { weekday: 'short' })

export function WeeklyChart({ data, title = 'Hours — last 7 days' }: Props) {
  const max = Math.max(...data.map((d) => d.hours), 4)

  return (
    <div className="card p-5">
      <h3 className="mb-4 text-sm font-semibold text-neutral-800">{title}</h3>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 12, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={[0, max]}
            tick={{ fontSize: 11, fill: '#94a3b8' }}
            tickFormatter={(v) => `${v}h`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: '#f1f5f9' }}
            formatter={(v: number) => [`${v.toFixed(1)}h`, 'Hours']}
            labelFormatter={(label, payload) =>
              payload?.[0]?.payload?.date ?? label
            }
            contentStyle={{
              fontSize: 12,
              border: '1px solid #e2e8f0',
              borderRadius: 6,
            }}
          />
          <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell
                key={entry.label}
                fill={entry.label === TODAY_LABEL ? '#2563eb' : '#93c5fd'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="mt-2 text-right text-[11px] text-neutral-400">
        Today highlighted in blue
      </p>
    </div>
  )
}
