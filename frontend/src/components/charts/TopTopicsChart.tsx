import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TopicPoint } from '@/types/api'
import { ChartTooltip } from '@/components/charts/ChartTooltip'

interface TopTopicsChartProps {
  data: TopicPoint[]
}

// Ranked magnitude comparison across named categories — one hue for every
// bar (not a value-ramp on nominal categories, per the dataviz skill's
// anti-patterns), since the topics are already directly labeled on the axis.
export function TopTopicsChart({ data }: TopTopicsChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
        Log a session to see your top topics here.
      </div>
    )
  }

  const height = Math.max(120, data.length * 44)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 4, bottom: 4 }}
        barCategoryGap="30%"
      >
        <CartesianGrid strokeDasharray="0" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          dataKey="title"
          type="category"
          width={110}
          tick={{ fill: 'var(--foreground)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(title: string) => (title.length > 16 ? `${title.slice(0, 15)}…` : title)}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)' }}
          content={<ChartTooltip formatValue={(v) => `${v.toFixed(1)}h`} />}
        />
        <Bar dataKey="hours" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive />
      </BarChart>
    </ResponsiveContainer>
  )
}
