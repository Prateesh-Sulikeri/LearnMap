import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DailyHoursPoint } from '@/types/api'
import { ChartTooltip } from '@/components/charts/ChartTooltip'

interface WeeklyHoursChartProps {
  data: DailyHoursPoint[]
}

function formatDayLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short' })
}

function formatDayTooltipLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// A single-series trend-over-time chart — sequential encoding (one hue), per
// the dataviz skill. No legend needed for one series; the card title already
// says what's plotted.
export function WeeklyHoursChart({ data }: WeeklyHoursChartProps) {
  const hasData = data.some((d) => d.hours > 0)

  if (!hasData) {
    return (
      <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
        Log a session this week to see your hours here.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid strokeDasharray="0" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={formatDayLabel}
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          axisLine={{ stroke: 'var(--border)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
          width={28}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)' }}
          content={<ChartTooltip formatValue={(v) => `${v.toFixed(1)}h`} formatLabel={formatDayTooltipLabel} />}
        />
        <Bar dataKey="hours" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={32} isAnimationActive />
      </BarChart>
    </ResponsiveContainer>
  )
}
