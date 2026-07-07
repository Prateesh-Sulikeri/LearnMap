import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Plus } from 'lucide-react'
import moment from 'moment'
import { momentLocalizer } from 'react-big-calendar'
import type { View } from 'react-big-calendar'
import { sessionsApi } from '@/services/sessionsApi'
import { itemsApi } from '@/services/itemsApi'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AddSessionDialog } from '@/components/AddSessionDialog'
import { DeleteSessionDialog } from '@/components/DeleteSessionDialog'
import ShadcnBigCalendar from '@/components/shadcn-big-calendar/shadcn-big-calendar'

const localizer = momentLocalizer(moment)

export default function StudySessionsPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [calendarView, setCalendarView] = useState<View>('week')

  const {
    data: sessions,
    isLoading,
    isError,
  } = useQuery({ queryKey: ['sessions'], queryFn: () => sessionsApi.list() })
  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: itemsApi.list })

  const titleByItemId = new Map(items.map((item) => [item.id, item.title]))

  const calendarEvents = (sessions ?? []).map((session) => {
    const start = new Date(session.session_date)
    return {
      title: `${titleByItemId.get(session.learning_item_id) ?? 'Unknown'} (${session.hours}h)`,
      start,
      end: new Date(start.getTime() + session.hours * 60 * 60 * 1000),
    }
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Study Sessions</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add Session
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-destructive">Couldn&apos;t load your sessions. Try refreshing the page.</p>
      )}

      {sessions && (
        <div className="rounded-xl border border-border p-2">
          <ShadcnBigCalendar
            localizer={localizer}
            events={calendarEvents}
            view={calendarView}
            onView={setCalendarView}
            style={{ height: 650 }}
            eventPropGetter={() => ({ className: 'event-variant-primary' })}
          />
        </div>
      )}

      {sessions && sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <CalendarClock className="size-10 text-muted-foreground" />
          <h2 className="font-heading text-lg font-semibold">No study sessions yet</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Log your first session to start building your streak.
          </p>
        </div>
      )}

      <AddSessionDialog open={addOpen} onOpenChange={setAddOpen} />
      {deleteId && (
        <DeleteSessionDialog
          open={deleteId !== null}
          onOpenChange={(open) => !open && setDeleteId(null)}
          sessionId={deleteId}
        />
      )}
    </div>
  )
}
