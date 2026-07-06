import type { ComponentType } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, CheckCircle2, Flame, ListTodo } from 'lucide-react'
import { dashboardApi } from '@/services/dashboardApi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface StatCardProps {
  label: string
  value: string
  icon: ComponentType<{ className?: string }>
}

function StatCard({ label, value, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="font-mono text-2xl leading-none font-semibold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

// Weekly-hours/top-topics *charts* are Milestone 4's job (Recharts); this
// renders the same underlying dashboard data as plain stat cards + lists.
export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get })

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    )
  }

  if (isError || !data) {
    return <p className="text-sm text-destructive">Couldn&apos;t load your dashboard. Try refreshing the page.</p>
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Study hours this week" value={data.study_hours_this_week.toFixed(1)} icon={CalendarClock} />
        <StatCard label="Current streak" value={`${data.current_streak}d`} icon={Flame} />
        <StatCard label="Completed" value={String(data.completed_items)} icon={CheckCircle2} />
        <StatCard label="Pending" value={String(data.pending_items)} icon={ListTodo} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-base">Top topics</CardTitle>
          </CardHeader>
          <CardContent>
            {data.top_topics.length === 0 ? (
              <p className="text-sm text-muted-foreground">Log a session to see your top topics here.</p>
            ) : (
              <ul className="space-y-2">
                {data.top_topics.map((topic) => (
                  <li key={topic.learning_item_id} className="flex items-center justify-between text-sm">
                    <span className="truncate">{topic.title}</span>
                    <span className="font-mono text-muted-foreground">{topic.hours.toFixed(1)}h</span>
                  </li>
                ))}
              </ul>
            )}
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
