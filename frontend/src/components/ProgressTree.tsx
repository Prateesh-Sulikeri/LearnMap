import { ListTree } from 'lucide-react'
import { useLearningTree } from '@/hooks/useLearningTree'
import { useCollapsedState } from '@/hooks/useCollapsedState'
import { ProgressTreeNode } from '@/components/ProgressTreeNode'
import { Skeleton } from '@/components/ui/skeleton'

export function ProgressTree() {
  const { tree, isLoading, isError } = useLearningTree()
  const { isCollapsed, toggle } = useCollapsedState()

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-5/6" />
      </div>
    )
  }

  if (isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load your learning map.</p>
  }

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <ListTree className="size-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Add something to your learning map to see progress here.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-0.5">
      {tree.map((node, index) => (
        <ProgressTreeNode
          key={node.id}
          node={node}
          depth={0}
          isCollapsed={isCollapsed}
          onToggle={toggle}
          isLast={index === tree.length - 1}
          ancestorLines={[]}
        />
      ))}
    </ul>
  )
}
