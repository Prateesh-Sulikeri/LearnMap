import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
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

const itemFormSchema = z.object({
  title: z.string().min(1, 'Give it a title'),
  notes: z.string().optional(),
})
type ItemFormValues = z.infer<typeof itemFormSchema>

interface ItemFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'rename'
  /** Required when mode === 'rename'. */
  itemId?: string
  /** Used when mode === 'create'; omit for a root-level item. */
  parentId?: string
  /** Required when mode === 'rename'. */
  initialTitle?: string
  /** The item's existing notes, when mode === 'rename'. */
  initialDescription?: string | null
}

// Shared by "quick add" (root item), "add child" (nested), and "rename" —
// same shape (a title + optional short notes), so one dialog covers all
// three rather than three near-identical components.
export function ItemFormDialog({
  open,
  onOpenChange,
  mode,
  itemId,
  parentId,
  initialTitle,
  initialDescription,
}: ItemFormDialogProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ItemFormValues>({ resolver: zodResolver(itemFormSchema) })

  useEffect(() => {
    if (open) {
      reset({
        title: mode === 'rename' ? initialTitle : '',
        notes: mode === 'rename' ? (initialDescription ?? '') : '',
      })
    }
  }, [open, mode, initialTitle, initialDescription, reset])

  const mutation = useMutation({
    mutationFn: (values: ItemFormValues) =>
      mode === 'rename' && itemId
        ? itemsApi.update(itemId, { title: values.title, description: values.notes || undefined })
        : itemsApi.create({ title: values.title, description: values.notes || undefined, parent_id: parentId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      toast.success(mode === 'rename' ? 'Saved' : 'Added to your learning map')
      onOpenChange(false)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v))(e)} noValidate className="space-y-4">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {mode === 'rename' ? 'Edit item' : parentId ? 'Add sub-item' : 'Add something to learn'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'rename'
                ? 'Update the title or notes for this item.'
                : parentId
                  ? 'Creates a new item nested under this one.'
                  : 'Creates a new top-level topic in your learning map.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="item-form-title">Title</Label>
            <Input id="item-form-title" autoFocus placeholder="e.g. Kafka" {...register('title')} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-form-notes">Notes (optional)</Label>
            <Textarea id="item-form-notes" rows={3} placeholder="A short note about this topic…" {...register('notes')} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
