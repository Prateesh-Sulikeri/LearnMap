import { useOutletContext } from 'react-router-dom'
import { ListTree } from 'lucide-react'
import { useLearningTree } from '@/hooks/useLearningTree'
import { useCollapsedState } from '@/hooks/useCollapsedState'
import { nodeMatchesSearch } from '@/utils/tree'
import { TreeNode } from '@/components/TreeNode'
import { Skeleton } from '@/components/ui/skeleton'
import type { AppOutletContext } from '@/layouts/AppLayout'

export default function LearningTreePage() {
  const { searchQuery } = useOutletContext<AppOutletContext>()
  const { tree, isLoading, isError } = useLearningTree()
  const { isCollapsed, toggle } = useCollapsedState()

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-5/6" />
        <Skeleton className="h-10 w-4/6" />
      </div>
    )
  }

  if (isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load your learning map. Try refreshing the page.</p>
  }

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
        <ListTree className="size-10 text-muted-foreground" />
        <h2 className="font-heading text-lg font-semibold">Your learning map is empty</h2>
        <p className="max-w-xs text-sm text-muted-foreground">
          Tap the + button to add the first thing you want to learn.
        </p>
      </div>
    )
  }

  const visibleTree = searchQuery.trim() ? tree.filter((node) => nodeMatchesSearch(node, searchQuery)) : tree

  if (visibleTree.length === 0) {
    return <p className="text-sm text-muted-foreground">No items match &quot;{searchQuery}&quot;.</p>
  }

  return (
    <ul className="space-y-0.5">
      {visibleTree.map((node, index) => (
        <TreeNode
          key={node.id}
          node={node}
          depth={0}
          isCollapsed={isCollapsed}
          onToggle={toggle}
          isLast={index === visibleTree.length - 1}
          ancestorLines={[]}
        />
      ))}
    </ul>
  )
}
