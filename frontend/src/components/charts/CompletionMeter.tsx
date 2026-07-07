import { RadialBar, RadialBarChart, ResponsiveContainer } from 'recharts'

interface CompletionMeterProps {
  percentage: number
}

// A single ratio against a limit is a Meter, not a pie/donut (dataviz skill:
// "❌ A donut/pie for comparing... ✅ A stat tile / meter — the number is the
// chart"). Fill carries the value; the unfilled track is a lighter step of
// the same hue ramp (--accent is the soft-yellow step of the same warm-yellow
// ramp as --primary), so state reads across the whole ring at a glance.
export function CompletionMeter({ percentage }: CompletionMeterProps) {
  const clamped = Math.max(0, Math.min(100, percentage))
  const data = [{ value: clamped, fill: 'var(--chart-1)' }]

  return (
    <div className="relative flex items-center justify-center">
      <ResponsiveContainer width="100%" height={160}>
        <RadialBarChart
          data={data}
          startAngle={90}
          endAngle={-270}
          innerRadius="72%"
          outerRadius="100%"
          barSize={14}
        >
          <RadialBar dataKey="value" background={{ fill: 'var(--accent)' }} cornerRadius={7} isAnimationActive />
        </RadialBarChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <p className="font-mono text-2xl font-semibold text-foreground">{Math.round(clamped)}%</p>
        <p className="text-xs text-muted-foreground">complete</p>
      </div>
    </div>
  )
}
