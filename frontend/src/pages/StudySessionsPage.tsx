import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarClock, Plus, Trash2 } from 'lucide-react'
import { sessionsApi } from '@/services/sessionsApi'
import { itemsApi } from '@/services/itemsApi'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AddSessionDialog } from '@/components/AddSessionDialog'
import { DeleteSessionDialog } from '@/components/DeleteSessionDialog'

export default function StudySessionsPage() {
  const [addOpen, setAddOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const {
    data: sessions,
    isLoading,
    isError,
  } = useQuery({ queryKey: ['sessions'], queryFn: () => sessionsApi.list() })
  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: itemsApi.list })

  const titleByItemId = new Map(items.map((item) => [item.id, item.title]))

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

      {sessions && sessions.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <CalendarClock className="size-10 text-muted-foreground" />
          <h2 className="font-heading text-lg font-semibold">No study sessions yet</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Log your first session to start building your streak.
          </p>
        </div>
      )}

      {sessions && sessions.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Topic</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow key={session.id}>
                  <TableCell className="font-mono text-sm whitespace-nowrap">{session.session_date}</TableCell>
                  <TableCell>{titleByItemId.get(session.learning_item_id) ?? 'Unknown'}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{session.hours}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{session.notes ?? '—'}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label="Delete session"
                      onClick={() => setDeleteId(session.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
