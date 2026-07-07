import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, CalendarRange, Calendar as CalendarIcon } from 'lucide-react'
import { dashboardApi } from '@/services/dashboardApi'
import type { StatsRange } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { HoursTrendChart } from '@/components/charts/HoursTrendChart'
import { cn } from '@/lib/utils'

const RANGE_OPTIONS: { value: StatsRange; label: string; icon: typeof CalendarDays }[] = [
  { value: 'week', label: 'Weekly', icon: CalendarDays },
  { value: 'month', label: 'Monthly', icon: CalendarIcon },
  { value: 'year', label: 'Yearly', icon: CalendarRange },
]

// Range lives in the URL (not local state), matching the Learning page's
// tab/search convention — "Statistics?range=month" is a real, shareable,
// back-button-friendly link, not just a snapshot of local component state.
export default function StatisticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rangeParam = searchParams.get('range')
  const range: StatsRange = rangeParam === 'month' ? 'month' : rangeParam === 'year' ? 'year' : 'week'
  const setRange = (next: StatsRange) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === 'week') params.delete('range')
      else params.set('range', next)
      return params
    })
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ['stats', range],
    queryFn: () => dashboardApi.getStats(range),
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Statistics</h1>
      </div>

      {/* Filter row above the chart it scopes, per the dataviz skill —
          never per-chart-card controls. Only one chart on this page, so it
          scopes just the one, but the placement/pattern stays consistent
          with a page that had more than one. */}
      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border p-0.5 md:w-fit">
        {RANGE_OPTIONS.map(({ value, label, icon: Icon }) => (
          <Button
            key={value}
            type="button"
            variant="ghost"
            size="sm"
            className={cn('gap-1.5', range === value && 'bg-accent text-accent-foreground')}
            onClick={() => setRange(value)}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">
            {range === 'week' ? 'Hours this week' : range === 'month' ? 'Hours this month' : 'Hours this year'}
          </CardTitle>
          <CardDescription>
            {range === 'week' && 'Daily study hours over the last 7 days.'}
            {range === 'month' && 'Daily study hours over the last 30 days.'}
            {range === 'year' && 'Monthly study hours over the last 12 months.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && <Skeleton className="h-64 w-full" />}
          {isError && (
            <p className="text-sm text-destructive">Couldn&apos;t load your statistics. Try refreshing the page.</p>
          )}
          {data && <HoursTrendChart points={data.points} range={range} />}
        </CardContent>
      </Card>
    </div>
  )
}
