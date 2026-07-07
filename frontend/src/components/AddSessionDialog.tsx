import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { sessionsApi } from '@/services/sessionsApi'
import { itemsApi } from '@/services/itemsApi'
import { getApiErrorMessage } from '@/utils/apiError'
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
import { TopicMultiSelect } from '@/components/TopicMultiSelect'

const sessionFormSchema = z
  .object({
    learningItemIds: z.array(z.string()).min(1, 'Pick at least one topic'),
    sessionStart: z.string().min(1, 'Pick a start time'),
    sessionEnd: z.string().min(1, 'Pick an end time'),
    notes: z.string().optional(),
  })
  .refine((data) => new Date(data.sessionStart) < new Date(data.sessionEnd), {
    message: 'End time must be after start time',
    path: ['sessionEnd'],
  })
  .refine((data) => new Date(data.sessionEnd) <= new Date(), {
    message: "Can't log a session that hasn't happened yet — use Schedule Session for that",
    path: ['sessionEnd'],
  })
  .refine(
    (data) => (new Date(data.sessionEnd).getTime() - new Date(data.sessionStart).getTime()) / 3_600_000 <= 24,
    { message: 'A single session can be at most 24 hours', path: ['sessionEnd'] },
  )

type SessionFormInput = z.input<typeof sessionFormSchema>
type SessionFormValues = z.output<typeof sessionFormSchema>

function formatDateTimeLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${h}:${min}`
}

interface AddSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-selects the topic — used when logging time directly from a tree node. Still changeable. */
  defaultItemId?: string
}

export function AddSessionDialog({ open, onOpenChange, defaultItemId }: AddSessionDialogProps) {
  const queryClient = useQueryClient()
  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: itemsApi.list })

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<SessionFormInput, unknown, SessionFormValues>({ resolver: zodResolver(sessionFormSchema) })

  useEffect(() => {
    if (open) {
      const end = new Date()
      const start = new Date(end.getTime() - 60 * 60 * 1000)
      reset({
        learningItemIds: defaultItemId ? [defaultItemId] : [],
        sessionStart: formatDateTimeLocal(start),
        sessionEnd: formatDateTimeLocal(end),
        notes: '',
      })
    }
  }, [open, defaultItemId, reset])

  const sessionStart = watch('sessionStart')
  const sessionEnd = watch('sessionEnd')
  const computedHours =
    sessionStart && sessionEnd
      ? Math.max(0, (new Date(sessionEnd).getTime() - new Date(sessionStart).getTime()) / 3_600_000)
      : 0

  const mutation = useMutation({
    mutationFn: (values: SessionFormValues) => {
      const start = new Date(values.sessionStart)
      const end = new Date(values.sessionEnd)
      return sessionsApi.create({
        learning_item_ids: values.learningItemIds,
        session_date: formatDateTimeLocal(start).slice(0, 10),
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
        notes: values.notes || undefined,
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Session logged')
      onOpenChange(false)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v))(e)} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-heading">Log a study session</DialogTitle>
            <DialogDescription>Track time spent so your dashboard and streak stay accurate.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="session-topics">Topics</Label>
            <Controller
              control={control}
              name="learningItemIds"
              render={({ field }) => (
                <TopicMultiSelect
                  id="session-topics"
                  items={items}
                  selectedIds={field.value ?? []}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.learningItemIds && <p className="text-sm text-destructive">{errors.learningItemIds.message}</p>}
            {items.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Add something to your learning map first before logging a session against it.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="session-start">Start</Label>
              <Input id="session-start" type="datetime-local" {...register('sessionStart')} />
              {errors.sessionStart && <p className="text-sm text-destructive">{errors.sessionStart.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-end">End</Label>
              <Input id="session-end" type="datetime-local" {...register('sessionEnd')} />
              {errors.sessionEnd && <p className="text-sm text-destructive">{errors.sessionEnd.message}</p>}
            </div>
          </div>
          {computedHours > 0 && (
            <p className="text-xs text-muted-foreground">
              {computedHours.toFixed(2)} hour{computedHours === 1 ? '' : 's'}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="session-notes">Notes (optional)</Label>
            <Textarea id="session-notes" rows={3} placeholder="What did you work through?" {...register('notes')} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || items.length === 0}>
              {mutation.isPending ? 'Saving…' : 'Add session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
