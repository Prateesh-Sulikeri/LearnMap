import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { itemsApi } from '@/services/itemsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

export default function TrashPage() {
  const queryClient = useQueryClient()
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
      <div>
        <h1 className="font-heading text-xl font-semibold">Trash</h1>
        <p className="text-sm text-muted-foreground">
          Deleting an item also deletes its sub-items — restoring it brings them all back together.
        </p>
      </div>

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
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">Deleted {new Date(item.deleted_at).toLocaleString()}</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => restore.mutate(item.id)} disabled={restore.isPending}>
                Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
