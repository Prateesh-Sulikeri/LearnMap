import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Circle, CircleCheck, Star } from 'lucide-react'
import { toast } from 'sonner'
import { itemsApi } from '@/services/itemsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import type { LearningTreeNode } from '@/utils/tree'
import { cn } from '@/lib/utils'
import { NoteIndicator } from '@/components/tree/NoteIndicator'

interface FavoritesListProps {
  items: LearningTreeNode[]
  onOpenNotes: (id: string) => void
}

// A flat list, not a tree — a favorited item can be at any depth, so there's
// no sensible parent/child structure to render here the way TreeNode does.
// Deliberately minimal (status + note + unfavorite only, no rename/delete/log
// session menu) — those stay in the main List/Map views; this is just a
// quick-access shortlist.
export function FavoritesList({ items, onOpenNotes }: FavoritesListProps) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <FavoriteRow key={item.id} item={item} onOpenNotes={onOpenNotes} />
      ))}
    </ul>
  )
}

function FavoriteRow({ item, onOpenNotes }: { item: LearningTreeNode; onOpenNotes: (id: string) => void }) {
  const completed = item.status === 'completed'
  const queryClient = useQueryClient()

  const toggleStatus = useMutation({
    mutationFn: () => itemsApi.setStatus(item.id, { status: completed ? 'in_progress' : 'completed' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      toast.success(completed ? 'Reopened' : 'Marked complete')
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  const unfavorite = useMutation({
    mutationFn: () => itemsApi.setFavorite(item.id, false),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['items'] }),
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  return (
    <li className="flex min-h-11 items-center gap-2 rounded-lg py-2 pr-2 transition-colors duration-150 hover:bg-accent">
      <button
        type="button"
        onClick={() => toggleStatus.mutate()}
        disabled={toggleStatus.isPending}
        aria-label={completed ? 'Reopen' : 'Mark complete'}
        className="shrink-0 transition-transform duration-150 active:scale-90"
      >
        {completed ? (
          <CircleCheck className="size-5 text-success" />
        ) : (
          <Circle className="size-5 text-muted-foreground hover:text-foreground" />
        )}
      </button>

      <button
        type="button"
        onClick={() => onOpenNotes(item.id)}
        className={cn('truncate text-left text-sm', completed && 'text-success line-through decoration-success/50')}
      >
        {item.title}
      </button>
      <NoteIndicator note={item.description} onClick={() => onOpenNotes(item.id)} />

      <button
        type="button"
        onClick={() => unfavorite.mutate()}
        disabled={unfavorite.isPending}
        aria-label="Remove from favorites"
        className="ml-auto shrink-0 transition-transform duration-150 active:scale-90"
      >
        <Star className="size-4 fill-primary text-primary" />
      </button>
    </li>
  )
}
