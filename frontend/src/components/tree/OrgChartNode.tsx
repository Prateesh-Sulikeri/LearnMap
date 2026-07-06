import { ChevronDown, Circle, CircleCheck } from 'lucide-react'
import { countCompletion, type LearningTreeNode } from '@/utils/tree'
import { cn } from '@/lib/utils'

interface OrgChartNodeProps {
  node: LearningTreeNode
  isCollapsed: (id: string) => boolean
  onToggle: (id: string) => void
}

export function OrgChartNode({ node, isCollapsed, onToggle }: OrgChartNodeProps) {
  const hasChildren = node.children.length > 0
  const collapsed = isCollapsed(node.id)
  const completed = node.status === 'completed'
  const { completed: completedCount, total } = countCompletion(node)

  return (
    <li>
      <button
        type="button"
        onClick={() => hasChildren && onToggle(node.id)}
        className={cn(
          'inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-sm whitespace-nowrap shadow-sm transition-colors duration-150 hover:bg-accent',
          hasChildren && 'cursor-pointer',
        )}
      >
        {completed ? (
          <CircleCheck className="size-4 shrink-0 text-success" aria-label="Completed" />
        ) : (
          <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className={cn(completed && 'text-success line-through decoration-success/50')}>{node.title}</span>
        {hasChildren && (
          <span className="font-mono text-xs text-muted-foreground">
            {completedCount}/{total}
          </span>
        )}
        {hasChildren && (
          <ChevronDown
            className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform duration-150', collapsed && '-rotate-90')}
          />
        )}
      </button>

      {hasChildren && !collapsed && (
        <ul>
          {node.children.map((child) => (
            <OrgChartNode key={child.id} node={child} isCollapsed={isCollapsed} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </li>
  )
}
