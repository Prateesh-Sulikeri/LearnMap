import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { StatsPoint, StatsRange } from '@/types/api'
import { ChartTooltip } from '@/components/charts/ChartTooltip'

interface HoursTrendChartProps {
  points: StatsPoint[]
  range: StatsRange
}

function formatPeriodTick(period: string, range: StatsRange): string {
  if (range === 'year') {
    const [y, m] = period.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' })
  }
  const [y, m, d] = period.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function formatPeriodTooltipLabel(period: string, range: StatsRange): string {
  if (range === 'year') {
    const [y, m] = period.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  }
  const [y, m, d] = period.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

// Trend-over-time, single series → area chart, sequential (one hue) per the
// dataviz skill. No legend needed (one series; the card title says what's
// plotted). Week/month show daily points; year shows monthly points — same
// component, since the only difference is period-label formatting.
export function HoursTrendChart({ points, range }: HoursTrendChartProps) {
  const hasData = points.some((p) => p.hours > 0)

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Log a session to see your hours here.
      </div>
    )
  }

  // Month range (30 daily points) gets crowded with a tick per point —
  // thin the x-axis ticks instead of shrinking/rotating the labels.
  const tickInterval = range === 'month' ? Math.ceil(points.length / 10) : 0

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="hoursTrendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="period"
          tickFormatter={(period: string) => formatPeriodTick(period, range)}
          interval={tickInterval}
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
          cursor={{ stroke: 'var(--chart-1)', strokeWidth: 1 }}
          content={
            <ChartTooltip
              formatValue={(v) => `${v.toFixed(1)}h`}
              formatLabel={(label) => formatPeriodTooltipLabel(label, range)}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="hours"
          stroke="var(--chart-1)"
          strokeWidth={2}
          fill="url(#hoursTrendFill)"
          isAnimationActive
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
