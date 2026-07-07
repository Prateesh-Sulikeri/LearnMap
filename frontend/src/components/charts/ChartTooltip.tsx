import type { TooltipContentProps } from 'recharts'

// Recharts injects active/payload/label/etc. via cloneElement at render time
// — they're required on TooltipContentProps for Recharts' own internal use,
// but not something callers provide at JSX-authoring time, hence Partial.
interface ChartTooltipProps extends Partial<TooltipContentProps<number, string>> {
  /** Formats the numeric value shown in the tooltip (e.g. "2.5h"). */
  formatValue?: (value: number) => string
  /** Formats the label shown at the top of the tooltip (e.g. a date). */
  formatLabel?: (label: string) => string
}

// A single shared tooltip so every chart on Dashboard/Statistics matches the
// app's card styling instead of Recharts' unstyled default. Per the dataviz
// skill: values lead (strong, high-contrast), labels follow (secondary) —
// the inverse of a legend's hierarchy, since the reader already has the
// series and wants the number.
export function ChartTooltip({ active, payload, label, formatValue, formatLabel }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  const point = payload[0]
  const value = typeof point.value === 'number' ? point.value : Number(point.value)

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      {label !== undefined && (
        <p className="text-xs text-muted-foreground">{formatLabel ? formatLabel(String(label)) : label}</p>
      )}
      <p className="font-mono text-sm font-semibold">{formatValue ? formatValue(value) : value}</p>
    </div>
  )
}
