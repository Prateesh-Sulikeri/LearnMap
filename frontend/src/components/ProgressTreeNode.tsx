import { ChevronRight, Circle, CircleCheck } from 'lucide-react'
import { countCompletion, type LearningTreeNode } from '@/utils/tree'
import { cn } from '@/lib/utils'
import { TreeGuides } from '@/components/tree/TreeGuides'

interface ProgressTreeNodeProps {
  node: LearningTreeNode
  depth: number
  isCollapsed: (id: string) => boolean
  onToggle: (id: string) => void
  isLast: boolean
  ancestorLines: boolean[]
}

// A read-only twin of TreeNode for the Dashboard — same tree assembly,
// connector-line visuals, and collapse state (shares the same localStorage
// key, so expand/collapse stays consistent whether you're looking at the
// Learning page or here), but no edit actions: this is a summary view of
// what's done vs. pending, not an editing surface.
export function ProgressTreeNode({ node, depth, isCollapsed, onToggle, isLast, ancestorLines }: ProgressTreeNodeProps) {
  const hasChildren = node.children.length > 0
  const collapsed = isCollapsed(node.id)
  const completed = node.status === 'completed'
  const { completed: completedCount, total } = countCompletion(node)

  return (
    <li>
      <div
        className="group relative flex items-center gap-1 rounded-lg py-1.5 pr-2 transition-colors duration-150 [--indent:1rem] hover:bg-accent md:[--indent:1.5rem]"
        style={{ '--depth': depth } as React.CSSProperties}
      >
        <TreeGuides depth={depth} ancestorLines={ancestorLines} isLast={isLast} />

        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(
            'flex min-h-9 flex-1 items-center gap-2 pl-[calc(var(--depth)*var(--indent))] text-left',
            hasChildren && 'cursor-pointer',
          )}
        >
          <span
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded transition-transform duration-150',
              hasChildren ? 'text-muted-foreground' : 'invisible',
              hasChildren && !collapsed && 'rotate-90',
            )}
            aria-hidden
          >
            <ChevronRight className="size-4" />
          </span>

          {completed ? (
            <CircleCheck className="size-4 shrink-0 text-success" aria-label="Completed" />
          ) : (
            <Circle className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          )}

          <span className={cn('truncate text-sm', completed && 'text-success line-through decoration-success/50')}>
            {node.title}
          </span>

          {hasChildren && (
            <span className="ml-auto shrink-0 pl-2 font-mono text-xs text-muted-foreground">
              {completedCount}/{total}
            </span>
          )}
        </button>
      </div>

      {hasChildren && !collapsed && (
        <ul>
          {node.children.map((child, index) => (
            <ProgressTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              isCollapsed={isCollapsed}
              onToggle={onToggle}
              isLast={index === node.children.length - 1}
              ancestorLines={[...ancestorLines, !isLast]}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
