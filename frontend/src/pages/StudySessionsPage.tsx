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
import { SessionDetailsDialog } from '@/components/SessionDetailsDialog'
import ShadcnBigCalendar from '@/components/shadcn-big-calendar/shadcn-big-calendar'
import type { StudySession } from '@/types/api'
import { getSessionStatus } from '@/utils/sessionStatus'

const localizer = momentLocalizer(moment)

function getStartOfToday(): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today
}

export default function StudySessionsPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [confirmSession, setConfirmSession] = useState<StudySession | null>(null)
  const [detailsSession, setDetailsSession] = useState<StudySession | null>(null)
  const [calendarView, setCalendarView] = useState<View>('month')
  const [calendarDate, setCalendarDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date>(getStartOfToday())

  const {
    data: sessions,
    isLoading,
    isError,
  } = useQuery({ queryKey: ['sessions'], queryFn: () => sessionsApi.list() })
  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: itemsApi.list })

  const titleByItemId = new Map(items.map((item) => [item.id, item.title]))

  // Get comma-joined topic titles for a session (may span more than one).
  const getTopicTitles = (session: StudySession) => {
    const ids = session.learning_item_ids.length > 0 ? session.learning_item_ids : [session.learning_item_id]
    return ids.map((id) => titleByItemId.get(id) ?? 'Unknown').join(', ')
  }

  const calendarEvents = (sessions ?? []).map((session) => {
    // Prefer real time-of-day when available (logged-with-times or scheduled
    // sessions); fall back to midnight + hours for old-style hours-only logs.
    const start = session.scheduled_start ? new Date(session.scheduled_start) : new Date(session.session_date)
    const end = session.scheduled_end
      ? new Date(session.scheduled_end)
      : new Date(start.getTime() + session.hours * 60 * 60 * 1000)
    return {
      id: session.id,
      title: `${getTopicTitles(session)} (${session.hours}h)`,
      start,
      end,
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
              scrollToTime={new Date()}
              style={{ height: 650 }}
              eventPropGetter={() => ({ className: 'event-variant-primary cursor-pointer' })}
              onSelectEvent={(event) => {
                setDetailsSession(event.resource || null)
              }}
              onSelectSlot={(slotInfo) => {
                setSelectedDay(slotInfo.start)
              }}
              selectable
              popup
            />
          </div>

          {/* Day-detail side panel */}
          <div className="rounded-xl border border-border p-4">
            <h3 className="font-heading text-sm font-semibold mb-4">
              {selectedDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </h3>
            {sessionsForSelectedDay.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
            ) : (
              <div className="space-y-3">
                {sessionsForSelectedDay.map((session) => {
                  const status = getSessionStatus(session)
                  const topicTitles = getTopicTitles(session)

                  return (
                    <button
                      key={session.id}
                      onClick={() => setDetailsSession(session)}
                      className="w-full text-left rounded-lg border border-border bg-card p-3 hover:bg-muted transition-colors"
                    >
                      <p className="font-semibold text-sm">{topicTitles}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {session.hours > 0 ? `${session.hours}h` : ''}
                        {session.scheduled_start ? (
                          <>
                            {' '}
                            {new Date(session.scheduled_start).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            {' — '}
                            {new Date(session.scheduled_end!).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </>
                        ) : null}
                      </p>
                      {status === 'expired' && (
                        <p className="text-xs text-destructive font-semibold mt-1">Not confirmed</p>
                      )}
                      {status === 'in_progress' && (
                        <p className="text-xs text-warning-text font-semibold mt-1">In progress</p>
                      )}
                      {status === 'upcoming' && (
                        <p className="text-xs text-muted-foreground font-semibold mt-1">Upcoming</p>
                      )}
                      {session.notes && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{session.notes}</p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
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
      <SessionDetailsDialog
        session={detailsSession}
        topicTitle={detailsSession ? getTopicTitles(detailsSession) : undefined}
        open={detailsSession !== null}
        onOpenChange={(open) => !open && setDetailsSession(null)}
        onConfirmClick={() => {
          if (detailsSession) setConfirmSession(detailsSession)
          setDetailsSession(null)
        }}
      />
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
