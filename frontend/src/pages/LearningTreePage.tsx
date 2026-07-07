import { useState } from 'react'
import { Link } from 'react-router-dom'
import { List, ListTree, Search, Trash2, Workflow } from 'lucide-react'
import { useLearningTree } from '@/hooks/useLearningTree'
import { useCollapsedState } from '@/hooks/useCollapsedState'
import { useTreeViewMode } from '@/hooks/useTreeViewMode'
import { nodeMatchesSearch } from '@/utils/tree'
import { TreeNode } from '@/components/TreeNode'
import { OrgChartTree } from '@/components/tree/OrgChartTree'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export default function LearningTreePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useTreeViewMode()
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your learning items…"
            className="pl-8"
            aria-label="Search"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('gap-1.5', viewMode === 'list' && 'bg-accent text-accent-foreground')}
            onClick={() => setViewMode('list')}
          >
            <List className="size-4" />
            List
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('gap-1.5', viewMode === 'chart' && 'bg-accent text-accent-foreground')}
            onClick={() => setViewMode('chart')}
          >
            <Workflow className="size-4" />
            Map
          </Button>
        </div>

        <Tooltip>
          <TooltipTrigger
            render={
              <Link
                to="/trash"
                aria-label="Trash"
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-accent-foreground"
              />
            }
          >
            <Trash2 className="size-4" />
          </TooltipTrigger>
          <TooltipContent>View and restore deleted items</TooltipContent>
        </Tooltip>
      </div>

      {visibleTree.length === 0 ? (
        <p className="text-sm text-muted-foreground">No items match &quot;{searchQuery}&quot;.</p>
      ) : viewMode === 'list' ? (
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
      ) : (
        <OrgChartTree tree={visibleTree} isCollapsed={isCollapsed} onToggle={toggle} />
      )}
    </div>
  )
}
