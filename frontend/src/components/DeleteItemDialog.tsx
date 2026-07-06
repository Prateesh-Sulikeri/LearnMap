import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { itemsApi } from '@/services/itemsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface DeleteItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemId: string
  itemTitle: string
  hasChildren: boolean
}

// Design doc §14: "Deleting requires confirmation." Soft-deleted at the DB
// layer (ADR-003, reversible in principle) but there's no undo UI in the
// MVP, so the copy here is honest about it being final from the app's
// perspective without falsely promising permanent erasure either.
export function DeleteItemDialog({ open, onOpenChange, itemId, itemTitle, hasChildren }: DeleteItemDialogProps) {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => itemsApi.remove(itemId),
    onSuccess: ({ deleted_count }) => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      void queryClient.invalidateQueries({ queryKey: ['sessions'] })
      toast.success(deleted_count > 1 ? `Deleted ${deleted_count} items` : 'Deleted')
      onOpenChange(false)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &quot;{itemTitle}&quot;?</AlertDialogTitle>
          <AlertDialogDescription>
            {hasChildren
              ? "This also removes everything nested under it, along with any study sessions logged against them. This can't be undone from the app."
              : "Any study sessions logged against it will be removed too. This can't be undone from the app."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={mutation.isPending}
            onClick={(e) => {
              e.preventDefault()
              mutation.mutate()
            }}
          >
            {mutation.isPending ? 'Deleting…' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
