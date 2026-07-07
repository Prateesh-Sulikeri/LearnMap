import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, CalendarDays, Calendar as CalendarIcon, CalendarRange, CheckCircle2, Flame, ListTodo } from 'lucide-react'
import { dashboardApi } from '@/services/dashboardApi'
import type { StatsRange } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/StatCard'
import { TopTopicsChart } from '@/components/charts/TopTopicsChart'
import { CompletionMeter } from '@/components/charts/CompletionMeter'
import { HoursTrendChart } from '@/components/charts/HoursTrendChart'
import { cn } from '@/lib/utils'

const RANGE_OPTIONS: { value: StatsRange; label: string; icon: typeof CalendarDays }[] = [
  { value: 'week', label: 'Weekly', icon: CalendarDays },
  { value: 'month', label: 'Monthly', icon: CalendarIcon },
  { value: 'year', label: 'Yearly', icon: CalendarRange },
]

export default function DashboardPage() {
  // Range lives in the URL (not local state), matching the Learning page's
  // tab/search convention — "Dashboard?range=month" is a real, shareable,
  // back-button-friendly link, not just a snapshot of local component state.
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

  const { data, isLoading, isError } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get })
  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
  } = useQuery({ queryKey: ['stats', range], queryFn: () => dashboardApi.getStats(range) })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-64 w-full md:col-span-2" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    )
  }

  if (isError || !data) {
    return <p className="text-sm text-destructive">Couldn&apos;t load your dashboard. Try refreshing the page.</p>
  }

  return (
    <div className="space-y-6">
      {/* auto-fit/minmax, not grid-cols-4 — a fixed 4-column grid truncated
          every label to a single letter around the tablet breakpoint (the
          sidebar eats into the available width before md:grid-cols-4 accounts
          for it). Same fix as ProfilePage's stat-tile row. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-4">
        <StatCard label="Study hours this week" value={data.study_hours_this_week.toFixed(1)} icon={CalendarClock} />
        <StatCard label="Current streak" value={`${data.current_streak}d`} icon={Flame} />
        <StatCard label="Completed" value={String(data.completed_items)} icon={CheckCircle2} />
        <StatCard label="Pending" value={String(data.pending_items)} icon={ListTodo} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="font-heading text-base">
                  {range === 'week' ? 'Hours this week' : range === 'month' ? 'Hours this month' : 'Hours this year'}
                </CardTitle>
                <CardDescription>
                  {range === 'week' && 'Daily study hours over the last 7 days.'}
                  {range === 'month' && 'Daily study hours over the last 30 days.'}
                  {range === 'year' && 'Monthly study hours over the last 12 months.'}
                </CardDescription>
              </div>
              {/* Filter row scoping the one chart below it, per the dataviz
                  skill — never per-chart controls buried elsewhere. */}
              <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border p-0.5">
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
            </div>
          </CardHeader>
          <CardContent>
            {statsLoading && <Skeleton className="h-64 w-full" />}
            {statsError && (
              <p className="text-sm text-destructive">Couldn&apos;t load your statistics. Try refreshing the page.</p>
            )}
            {stats && <HoursTrendChart points={stats.points} range={range} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Completion</CardTitle>
          </CardHeader>
          <CardContent>
            <CompletionMeter percentage={data.completion_percentage} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Top topics</CardTitle>
          </CardHeader>
          <CardContent>
            <TopTopicsChart data={data.top_topics} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Today&apos;s sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {data.todays_sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing logged yet today.</p>
            ) : (
              <ul className="space-y-2">
                {data.todays_sessions.map((session) => (
                  <li key={session.id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{session.notes ?? 'Study session'}</span>
                    <span className="font-mono text-muted-foreground">{session.hours}h</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Recent activity</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent_activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet — start by adding something to learn.</p>
          ) : (
            <ul className="space-y-2">
              {data.recent_activity.map((activity) => (
                <li
                  key={`${activity.type}-${activity.timestamp}-${activity.title}`}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate">
                    {activity.type === 'session_logged' ? 'Logged a session for ' : 'Updated '}
                    <span className="font-medium">{activity.title}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{new Date(activity.timestamp).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
