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

const itemFormSchema = z.object({
  title: z.string().min(1, 'Give it a title'),
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
}

// Shared by "quick add" (root item), "add child" (nested), and "rename" —
// same shape (a single title field), so one dialog covers all three rather
// than three near-identical components.
export function ItemFormDialog({ open, onOpenChange, mode, itemId, parentId, initialTitle }: ItemFormDialogProps) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ItemFormValues>({ resolver: zodResolver(itemFormSchema) })

  useEffect(() => {
    if (open) reset({ title: mode === 'rename' ? initialTitle : '' })
  }, [open, mode, initialTitle, reset])

  const mutation = useMutation({
    mutationFn: (title: string) =>
      mode === 'rename' && itemId
        ? itemsApi.update(itemId, { title })
        : itemsApi.create({ title, parent_id: parentId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      toast.success(mode === 'rename' ? 'Renamed' : 'Added to your learning map')
      onOpenChange(false)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => void handleSubmit((v) => mutation.mutate(v.title))(e)} noValidate>
          <DialogHeader>
            <DialogTitle className="font-heading">
              {mode === 'rename' ? 'Rename item' : parentId ? 'Add sub-item' : 'Add something to learn'}
            </DialogTitle>
            <DialogDescription>
              {mode === 'rename'
                ? 'Update the title of this item.'
                : parentId
                  ? 'Creates a new item nested under this one.'
                  : 'Creates a new top-level topic in your learning map.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            <Label htmlFor="item-form-title">Title</Label>
            <Input id="item-form-title" autoFocus placeholder="e.g. Kafka" {...register('title')} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
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
