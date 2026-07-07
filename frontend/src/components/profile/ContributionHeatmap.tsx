import type { DailyHoursPoint } from '@/types/api'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function levelFor(hours: number): 0 | 1 | 2 | 3 | 4 {
  if (hours <= 0) return 0
  if (hours <= 1) return 1
  if (hours <= 2) return 2
  if (hours <= 4) return 3
  return 4
}

const LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-muted',
  1: 'bg-success/20',
  2: 'bg-success/45',
  3: 'bg-success/70',
  4: 'bg-success',
}

interface DayCell {
  date: string
  hours: number
  weekday: number
}

interface WeekColumn {
  days: (DayCell | null)[]
  monthLabel: string | null
}

// GitHub-contribution-graph-style: a 7-row (Sun-Sat) grid, one column per
// week, oldest week on the left. The first/last columns are padded with
// nulls so every day lands in its correct weekday row even when the data
// range doesn't start on a Sunday.
function buildWeeks(points: DailyHoursPoint[]): WeekColumn[] {
  if (points.length === 0) return []

  const days: DayCell[] = points.map((p) => {
    const [y, m, d] = p.date.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return { date: p.date, hours: p.hours, weekday: date.getDay() }
  })

  const firstWeekday = days[0].weekday
  const padded: (DayCell | null)[] = [...Array<null>(firstWeekday).fill(null), ...days]

  const weeks: WeekColumn[] = []
  let lastMonth = -1
  for (let i = 0; i < padded.length; i += 7) {
    const weekDays = padded.slice(i, i + 7)
    while (weekDays.length < 7) weekDays.push(null)

    const firstRealDay = weekDays.find((d): d is DayCell => d !== null)
    let monthLabel: string | null = null
    if (firstRealDay) {
      const month = Number(firstRealDay.date.split('-')[1]) - 1
      if (month !== lastMonth) {
        monthLabel = MONTH_LABELS[month]
        lastMonth = month
      }
    }
    weeks.push({ days: weekDays, monthLabel })
  }
  return weeks
}

function formatDateLabel(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

interface ContributionHeatmapProps {
  data: DailyHoursPoint[]
}

// A GitHub-commit-graph-style visualization of daily study hours over the
// last 12 months — reused identically on the authenticated Profile page and
// the public shareable profile.
export function ContributionHeatmap({ data }: ContributionHeatmapProps) {
  const weeks = buildWeeks(data)
  const activeDays = data.filter((d) => d.hours > 0).length

  if (weeks.length === 0) {
    return <p className="text-sm text-muted-foreground">No study sessions logged yet.</p>
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto pb-1">
        <div className="flex w-max gap-[3px]">
          {weeks.map((week, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              <div className="h-3.5 text-[0.65rem] leading-none text-muted-foreground">{week.monthLabel ?? ''}</div>
              {week.days.map((day, j) =>
                day ? (
                  <Tooltip key={j}>
                    <TooltipTrigger render={<div className={cn('size-3 rounded-[3px]', LEVEL_CLASSES[levelFor(day.hours)])} />} />
                    <TooltipContent>
                      {day.hours > 0 ? `${day.hours}h studied` : 'No activity'} on {formatDateLabel(day.date)}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div key={j} className="size-3" />
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{activeDays} active days in the last year</span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <div key={level} className={cn('size-3 rounded-[3px]', LEVEL_CLASSES[level])} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
