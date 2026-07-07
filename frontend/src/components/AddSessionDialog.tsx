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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const sessionFormSchema = z.object({
  learningItemId: z.string().min(1, 'Pick a topic'),
  hours: z.coerce.number().gt(0, 'Must be more than 0').max(24, 'Must be 24 or less'),
  sessionDate: z.string().min(1, 'Pick a date'),
  notes: z.string().optional(),
})
// z.coerce.number() means the form's raw input value (a string, from a
// native <input type="number">) differs from the validated output value
// (a number) — RHF needs both: the input shape for field state, the output
// shape for what the submit handler receives.
type SessionFormInput = z.input<typeof sessionFormSchema>
type SessionFormValues = z.output<typeof sessionFormSchema>

function today(): string {
  return new Date().toISOString().slice(0, 10)
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
    formState: { errors },
  } = useForm<SessionFormInput, unknown, SessionFormValues>({ resolver: zodResolver(sessionFormSchema) })

  useEffect(() => {
    if (open) reset({ sessionDate: today(), learningItemId: defaultItemId ?? '', notes: '' })
  }, [open, defaultItemId, reset])

  const mutation = useMutation({
    mutationFn: (values: SessionFormValues) =>
      sessionsApi.create({
        learning_item_id: values.learningItemId,
        hours: values.hours,
        session_date: values.sessionDate,
        notes: values.notes || undefined,
      }),
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
            <Label htmlFor="session-topic">Topic</Label>
            <Controller
              control={control}
              name="learningItemId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="session-topic" className="w-full">
                    <SelectValue placeholder="Choose what you studied" />
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
            {items.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Add something to your learning map first before logging a session against it.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="session-hours">Hours</Label>
              <Input
                id="session-hours"
                type="number"
                step="0.25"
                min="0.25"
                max="24"
                className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                {...register('hours')}
              />
              {errors.hours && <p className="text-sm text-destructive">{errors.hours.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="session-date">Date</Label>
              <Input id="session-date" type="date" {...register('sessionDate')} />
              {errors.sessionDate && <p className="text-sm text-destructive">{errors.sessionDate.message}</p>}
            </div>
          </div>

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
