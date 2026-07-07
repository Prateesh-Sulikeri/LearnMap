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
import { ScheduleSessionDialog } from '@/components/ScheduleSessionDialog'
import { ConfirmSessionDialog } from '@/components/ConfirmSessionDialog'
import { DeleteSessionDialog } from '@/components/DeleteSessionDialog'
import ShadcnBigCalendar from '@/components/shadcn-big-calendar/shadcn-big-calendar'
import type { StudySession } from '@/types/api'

const localizer = momentLocalizer(moment)

export default function StudySessionsPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [confirmSession, setConfirmSession] = useState<StudySession | null>(null)
  const [calendarView, setCalendarView] = useState<View>('week')
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

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
      id: session.id,
      title: `${titleByItemId.get(session.learning_item_id) ?? 'Unknown'} (${session.hours}h)`,
      start,
      end: new Date(start.getTime() + session.hours * 60 * 60 * 1000),
      resource: session,
    }
  })

  const sessionsForSelectedDay = selectedDay
    ? (sessions ?? []).filter((s) => {
        const sessionDate = new Date(s.session_date)
        return (
          sessionDate.getFullYear() === selectedDay.getFullYear() &&
          sessionDate.getMonth() === selectedDay.getMonth() &&
          sessionDate.getDate() === selectedDay.getDate()
        )
      })
    : []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Study Sessions</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setScheduleOpen(true)}>
            <Plus className="size-4" />
            Schedule Session
          </Button>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" />
            Add Session
          </Button>
        </div>
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
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Calendar */}
          <div className="rounded-xl border border-border p-2 lg:col-span-2">
            <ShadcnBigCalendar
              localizer={localizer}
              events={calendarEvents}
              view={calendarView}
              onView={setCalendarView}
              date={calendarDate}
              onNavigate={setCalendarDate}
              style={{ height: 650 }}
              eventPropGetter={() => ({ className: 'event-variant-primary cursor-pointer' })}
              onSelectEvent={(event) => {
                if (event.resource?.scheduled_end) {
                  setConfirmSession(event.resource)
                } else {
                  setDeleteId(event.resource?.id || null)
                }
              }}
              onSelectSlot={(slotInfo) => {
                setSelectedDay(slotInfo.start)
              }}
              selectable
              popup
            />
          </div>

          {/* Day-detail side panel */}
          {selectedDay && (
            <div className="rounded-xl border border-border p-4">
              <h3 className="font-heading text-sm font-semibold mb-4">
                {selectedDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </h3>
              {sessionsForSelectedDay.length === 0 ? (
                <p className="text-xs text-muted-foreground">No sessions on this day</p>
              ) : (
                <div className="space-y-2">
                  {sessionsForSelectedDay.map((session) => (
                    <div key={session.id} className="rounded-lg border border-border bg-card p-3 text-xs space-y-1">
                      <p className="font-semibold">{titleByItemId.get(session.learning_item_id) || 'Unknown'}</p>
                      <p className="text-muted-foreground">
                        {session.hours}h {session.notes && `• ${session.notes}`}
                      </p>
                      <div className="flex gap-1 pt-2">
                        {session.scheduled_end && !session.confirmed_at ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs"
                            onClick={() => setConfirmSession(session)}
                          >
                            Confirm
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 text-xs text-destructive"
                          onClick={() => setDeleteId(session.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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
      <ScheduleSessionDialog open={scheduleOpen} onOpenChange={setScheduleOpen} />
      <ConfirmSessionDialog session={confirmSession} open={confirmSession !== null} onOpenChange={(open) => !open && setConfirmSession(null)} />
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
