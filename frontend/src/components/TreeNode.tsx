import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Circle, CircleCheck, Clock, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { itemsApi } from '@/services/itemsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import type { LearningTreeNode } from '@/utils/tree'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { TreeGuides } from '@/components/tree/TreeGuides'
import { ItemFormDialog } from '@/components/ItemFormDialog'
import { DeleteItemDialog } from '@/components/DeleteItemDialog'
import { AddSessionDialog } from '@/components/AddSessionDialog'

interface TreeNodeProps {
  node: LearningTreeNode
  depth: number
  isCollapsed: (id: string) => boolean
  onToggle: (id: string) => void
  /** Whether this node is the last child among its siblings (see TreeGuides). */
  isLast: boolean
  /** Ancestor continuation guides inherited from the parent (see TreeGuides). */
  ancestorLines: boolean[]
}

function ActionIcon({
  label,
  onClick,
  variant = 'ghost',
  children,
}: {
  label: string
  onClick: () => void
  variant?: 'ghost' | 'destructive-ghost'
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'size-7 shrink-0',
              variant === 'destructive-ghost' && 'text-destructive hover:bg-destructive/10 hover:text-destructive',
            )}
            aria-label={label}
            onClick={onClick}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

// Indentation shrinks on phone widths (1rem/level vs 1.5rem on tablet+) so
// deep trees stay readable on narrow screens instead of running out of
// horizontal space — the "adapted interaction pattern for narrow screens"
// the roadmap calls for on this page. Connector guide lines (TreeGuides)
// give the nesting an actual visual tree structure, not just indentation.
export function TreeNode({ node, depth, isCollapsed, onToggle, isLast, ancestorLines }: TreeNodeProps) {
  const hasChildren = node.children.length > 0
  const collapsed = isCollapsed(node.id)
  const completed = node.status === 'completed'
  const queryClient = useQueryClient()

  const [renameOpen, setRenameOpen] = useState(false)
  const [addChildOpen, setAddChildOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [logSessionOpen, setLogSessionOpen] = useState(false)

  const toggleStatus = useMutation({
    mutationFn: () => itemsApi.setStatus(node.id, { status: completed ? 'in_progress' : 'completed' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      toast.success(completed ? 'Reopened' : 'Marked complete')
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  return (
    <li>
      <div
        className="group relative flex items-center gap-1 rounded-lg py-2 pr-2 transition-colors duration-150 [--indent:1rem] hover:bg-accent md:[--indent:1.5rem]"
        style={{ '--depth': depth } as React.CSSProperties}
      >
        <TreeGuides depth={depth} ancestorLines={ancestorLines} isLast={isLast} />

        <div className="flex min-h-11 flex-1 items-center gap-2 pl-[calc(var(--depth)*var(--indent))]">
          <button
            type="button"
            onClick={() => hasChildren && onToggle(node.id)}
            className={cn(
              'flex size-6 shrink-0 items-center justify-center rounded transition-transform duration-150',
              hasChildren ? 'text-muted-foreground hover:text-foreground' : 'invisible',
              hasChildren && !collapsed && 'rotate-90',
            )}
            aria-label={hasChildren ? (collapsed ? 'Expand' : 'Collapse') : undefined}
            aria-hidden={!hasChildren}
          >
            <ChevronRight className="size-4" />
          </button>

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

          {/* Clicking the title toggles expand/collapse too — the chevron shouldn't be the only hit target. */}
          <button
            type="button"
            onClick={() => hasChildren && onToggle(node.id)}
            className={cn(
              'truncate text-left text-sm',
              hasChildren && 'cursor-pointer',
              completed && 'text-success line-through decoration-success/50',
            )}
          >
            {node.title}
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <ActionIcon label="Log a session" onClick={() => setLogSessionOpen(true)}>
            <Clock className="size-4" />
          </ActionIcon>
          <ActionIcon label="Add sub-item" onClick={() => setAddChildOpen(true)}>
            <Plus className="size-4" />
          </ActionIcon>
          <ActionIcon label="Rename" onClick={() => setRenameOpen(true)}>
            <Pencil className="size-4" />
          </ActionIcon>
          <ActionIcon label="Delete" variant="destructive-ghost" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
          </ActionIcon>
        </div>
      </div>

      {hasChildren && !collapsed && (
        <ul>
          {node.children.map((child, index) => (
            <TreeNode
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

      <ItemFormDialog open={renameOpen} onOpenChange={setRenameOpen} mode="rename" itemId={node.id} initialTitle={node.title} />
      <ItemFormDialog open={addChildOpen} onOpenChange={setAddChildOpen} mode="create" parentId={node.id} />
      <AddSessionDialog open={logSessionOpen} onOpenChange={setLogSessionOpen} defaultItemId={node.id} />
      <DeleteItemDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        itemId={node.id}
        itemTitle={node.title}
        hasChildren={hasChildren}
      />
    </li>
  )
}
