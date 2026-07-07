import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sessionsApi } from '@/services/sessionsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import { canConfirmSession } from '@/utils/sessionStatus'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

const confirmFormSchema = z.object({
  hours: z.coerce.number().optional(),
  notes: z.string().optional(),
})

type ConfirmFormInput = z.input<typeof confirmFormSchema>
type ConfirmFormValues = z.output<typeof confirmFormSchema>

interface ConfirmSessionDialogProps {
  session: StudySession | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConfirmSessionDialog({ session, open, onOpenChange }: ConfirmSessionDialogProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ConfirmFormInput, unknown, ConfirmFormValues>({ resolver: zodResolver(confirmFormSchema) })

  useEffect(() => {
    if (open && session) {
      reset({ hours: undefined, notes: session.notes || '' })
    }
  }, [open, session, reset])

  const mutation = useMutation({
    mutationFn: (values: ConfirmFormValues) => sessionsApi.confirm(session!.id, values),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Session confirmed')
      onOpenChange(false)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  if (!session) return null

  const scheduledStart = session.scheduled_start ? new Date(session.scheduled_start) : null
  const scheduledEnd = session.scheduled_end ? new Date(session.scheduled_end) : null
  const defaultHours = scheduledStart && scheduledEnd ? (scheduledEnd.getTime() - scheduledStart.getTime()) / (1000 * 60 * 60) : undefined
  const confirmable = canConfirmSession(session)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v))(e)} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-heading">Confirm study session</DialogTitle>
            <DialogDescription>Did you complete the session you scheduled? Great work!</DialogDescription>
          </DialogHeader>

          {scheduledStart && scheduledEnd && (
            <div className="rounded-lg border border-border bg-muted p-3">
              <p className="text-xs text-muted-foreground">
                {scheduledStart.toLocaleString()} – {scheduledEnd.toLocaleString()}
              </p>
            </div>
          )}

          {!confirmable && (
            <p className="text-sm text-destructive">
              This session hasn&apos;t started yet — you can confirm it once it begins.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirm-hours">
              Hours (optional — defaults to scheduled duration)
            </Label>
            <Input id="confirm-hours" type="number" step="0.25" min="0.25" max="24" placeholder={defaultHours?.toFixed(2)} {...register('hours')} />
            {errors.hours && <p className="text-sm text-destructive">{errors.hours.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-notes">Notes (optional)</Label>
            <Textarea id="confirm-notes" rows={3} placeholder="What did you accomplish?" {...register('notes')} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || !confirmable}>
              {mutation.isPending ? 'Confirming…' : 'Confirm session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
