import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Info, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { itemsApi } from '@/services/itemsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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

export default function TrashPage() {
  const queryClient = useQueryClient()
  const [purgeId, setPurgeId] = useState<string | null>(null)
  const [emptyOpen, setEmptyOpen] = useState(false)
  const { data: trash, isLoading, isError } = useQuery({ queryKey: ['trash'], queryFn: itemsApi.listTrash })

  const restore = useMutation({
    mutationFn: (id: string) => itemsApi.restore(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      toast.success(result.restored_count > 1 ? `Restored ${result.restored_count} items` : 'Restored')
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  const purge = useMutation({
    mutationFn: (id: string) => itemsApi.deletePermanently(id),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
      toast.success(result.deleted_count > 1 ? `Permanently deleted ${result.deleted_count} items` : 'Permanently deleted')
      setPurgeId(null)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  const emptyTrash = useMutation({
    mutationFn: () => itemsApi.emptyTrash(),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['trash'] })
      toast.success(result.deleted_count > 0 ? `Permanently deleted ${result.deleted_count} items` : 'Trash was already empty')
      setEmptyOpen(false)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  const purgeTarget = trash?.find((item) => item.id === purgeId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    )
  }

  if (isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load your trash. Try refreshing the page.</p>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-heading text-xl font-semibold">
            <Trash2 className="size-5 text-destructive" />
            Trash
          </h1>
          <p className="text-sm text-muted-foreground">
            Deleting an item also deletes its sub-items — restoring it brings them all back together.
          </p>
        </div>
        {trash && trash.length > 0 && (
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setEmptyOpen(true)}>
            Empty Trash
          </Button>
        )}
      </div>

      {trash && trash.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>Items are automatically and permanently deleted after 7 days in the trash.</p>
        </div>
      )}

      {!trash || trash.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
          <Trash2 className="size-10 text-muted-foreground" />
          <h2 className="font-heading text-lg font-semibold">Nothing in the trash</h2>
          <p className="max-w-xs text-sm text-muted-foreground">
            Deleted items show up here so you can bring them back if it was a mistake.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {trash.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <Trash2 className="size-4 shrink-0 text-destructive" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">Deleted {new Date(item.deleted_at).toLocaleString()}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => restore.mutate(item.id)} disabled={restore.isPending}>
                  Restore
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  aria-label="Delete permanently"
                  onClick={() => setPurgeId(item.id)}
                >
                  <X className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={purgeId !== null} onOpenChange={(open) => !open && setPurgeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete &quot;{purgeTarget?.title}&quot;?</AlertDialogTitle>
            <AlertDialogDescription>This can&apos;t be undone — there's no way to bring it back after this.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={purge.isPending}
              onClick={(e) => {
                e.preventDefault()
                if (purgeId) purge.mutate(purgeId)
              }}
            >
              {purge.isPending ? 'Deleting…' : 'Delete permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={emptyOpen} onOpenChange={setEmptyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty the trash?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently deletes everything currently in the trash ({trash?.length ?? 0}{' '}
              {trash?.length === 1 ? 'item' : 'items'}). This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={emptyTrash.isPending}
              onClick={(e) => {
                e.preventDefault()
                emptyTrash.mutate()
              }}
            >
              {emptyTrash.isPending ? 'Deleting…' : 'Empty Trash'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
