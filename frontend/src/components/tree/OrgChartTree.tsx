import { ListTree } from 'lucide-react'
import { useLearningTree } from '@/hooks/useLearningTree'
import { useCollapsedState } from '@/hooks/useCollapsedState'
import { OrgChartNode } from '@/components/tree/OrgChartNode'
import { Skeleton } from '@/components/ui/skeleton'
import './org-chart.css'

// A literal top-down tree diagram (root at top, children spreading out
// below, connected by lines) — a different visual job than the Learning
// tab's indented-list tree. Multiple top-level topics ("Backend", "Frontend",
// …) each get their own independent diagram, laid out left to right; the
// whole thing scrolls horizontally on its own so a wide or deep map never
// breaks the page layout, on any screen size.
export function OrgChartTree() {
  const { tree, isLoading, isError } = useLearningTree()
  const { isCollapsed, toggle } = useCollapsedState()

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-5/6" />
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
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex w-max min-w-full justify-center gap-10 px-2">
        {tree.map((root) => (
          <ul key={root.id} className="org-tree">
            <OrgChartNode node={root} isCollapsed={isCollapsed} onToggle={toggle} />
          </ul>
        ))}
      </div>
    </div>
  )
}
