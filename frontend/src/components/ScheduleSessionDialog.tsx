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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const scheduleFormSchema = z.object({
  learningItemId: z.string().min(1, 'Pick a topic'),
  scheduledStart: z.string().min(1, 'Pick a start time'),
  scheduledEnd: z.string().min(1, 'Pick an end time'),
})

type ScheduleFormInput = z.input<typeof scheduleFormSchema>
type ScheduleFormValues = z.output<typeof scheduleFormSchema>

interface ScheduleSessionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Pre-selected time slot, if coming from calendar drag/click */
  initialStart?: Date
  initialEnd?: Date
}

function formatDateTimeLocal(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const h = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${d}T${h}:${min}`
}

export function ScheduleSessionDialog({ open, onOpenChange, initialStart, initialEnd }: ScheduleSessionDialogProps) {
  const queryClient = useQueryClient()
  const { data: items = [] } = useQuery({ queryKey: ['items'], queryFn: itemsApi.list })

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ScheduleFormInput, unknown, ScheduleFormValues>({ resolver: zodResolver(scheduleFormSchema) })

  useEffect(() => {
    if (open) {
      const start = initialStart || new Date()
      const end = initialEnd || new Date(start.getTime() + 60 * 60 * 1000)
      reset({
        learningItemId: '',
        scheduledStart: formatDateTimeLocal(start),
        scheduledEnd: formatDateTimeLocal(end),
      })
    }
  }, [open, initialStart, initialEnd, reset])

  const mutation = useMutation({
    mutationFn: (values: ScheduleFormValues) =>
      sessionsApi.create({
        learning_item_id: values.learningItemId,
        scheduled_start: new Date(values.scheduledStart).toISOString(),
        scheduled_end: new Date(values.scheduledEnd).toISOString(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      toast.success('Session scheduled')
      onOpenChange(false)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v))(e)} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-heading">Schedule a study session</DialogTitle>
            <DialogDescription>Reserve time for a topic — confirm later once you&apos;ve completed it.</DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="schedule-topic">Topic</Label>
            <Controller
              control={control}
              name="learningItemId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="schedule-topic" className="w-full">
                    <SelectValue placeholder="Choose what you'll study" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.learningItemId && <p className="text-sm text-destructive">{errors.learningItemId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-start">Start</Label>
              <Input id="schedule-start" type="datetime-local" {...register('scheduledStart')} />
              {errors.scheduledStart && <p className="text-sm text-destructive">{errors.scheduledStart.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-end">End</Label>
              <Input id="schedule-end" type="datetime-local" {...register('scheduledEnd')} />
              {errors.scheduledEnd && <p className="text-sm text-destructive">{errors.scheduledEnd.message}</p>}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending || items.length === 0}>
              {mutation.isPending ? 'Scheduling…' : 'Schedule session'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
