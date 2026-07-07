import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sessionsApi } from '@/services/sessionsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import { canConfirmSession, getSessionStatus } from '@/utils/sessionStatus'
import type { StudySession } from '@/types/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface SessionDetailsDialogProps {
  session: StudySession | null
  topicTitle?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmClick?: () => void
}

export function SessionDetailsDialog({
  session,
  topicTitle,
  open,
  onOpenChange,
  onConfirmClick,
}: SessionDetailsDialogProps) {
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: () => sessionsApi.remove(session!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Session deleted')
      onOpenChange(false)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  if (!session) return null

  const sessionDate = new Date(session.session_date)
  const startTime = session.scheduled_start ? new Date(session.scheduled_start) : null
  const endTime = session.scheduled_end ? new Date(session.scheduled_end) : null
  const status = getSessionStatus(session)
  const canConfirm = canConfirmSession(session)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-heading">{topicTitle || 'Session'}</DialogTitle>
          <DialogDescription>Study session details</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Time/Date Information */}
          <div className="space-y-2 rounded-lg bg-muted p-3">
            {status !== 'logged' && startTime && endTime ? (
              <>
                <p className="text-xs font-semibold text-muted-foreground">SCHEDULED</p>
                <p className="text-sm">
                  {startTime.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' — '}
                  {endTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
                {status === 'upcoming' && (
                  <p className="text-xs text-muted-foreground font-semibold">
                    UPCOMING — starts {startTime.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {status === 'in_progress' && (
                  <p className="text-xs text-warning font-semibold">IN PROGRESS — awaiting confirmation</p>
                )}
                {status === 'expired' && (
                  <p className="text-xs text-destructive font-semibold">EXPIRED — not confirmed</p>
                )}
              </>
            ) : startTime && endTime ? (
              <>
                <p className="text-xs font-semibold text-muted-foreground">LOGGED</p>
                <p className="text-sm">
                  {startTime.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {' — '}
                  {endTime.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-muted-foreground">LOGGED</p>
                <p className="text-sm">
                  {sessionDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
              </>
            )}
          </div>

          {/* Hours */}
          {session.hours > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">HOURS</p>
              <p className="text-sm font-semibold">{session.hours} hours</p>
            </div>
          )}

          {/* Notes */}
          {session.notes && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">NOTES</p>
              <p className="text-sm whitespace-pre-wrap break-words">{session.notes}</p>
            </div>
          )}

          {/* Status Badge */}
          {session.confirmed_at && (
            <div className="text-xs text-muted-foreground">
              Confirmed {new Date(session.confirmed_at).toLocaleDateString()}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          {canConfirm && (
            <Button variant="default" onClick={() => {
              onOpenChange(false)
              onConfirmClick?.()
            }}>
              Confirm
            </Button>
          )}
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
