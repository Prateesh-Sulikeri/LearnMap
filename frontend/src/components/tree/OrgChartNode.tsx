import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Circle, CircleCheck, Clock, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { itemsApi } from '@/services/itemsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import { countCompletion, type LearningTreeNode } from '@/utils/tree'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NoteIndicator } from '@/components/tree/NoteIndicator'
import { ItemFormDialog } from '@/components/ItemFormDialog'
import { DeleteItemDialog } from '@/components/DeleteItemDialog'
import { AddSessionDialog } from '@/components/AddSessionDialog'

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
      <div className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card py-1.5 pr-1 pl-2 text-sm whitespace-nowrap shadow-sm">
        <button
          type="button"
          onClick={() => toggleStatus.mutate()}
          disabled={toggleStatus.isPending}
          aria-label={completed ? 'Reopen' : 'Mark complete'}
          className="shrink-0 transition-transform duration-150 active:scale-90"
        >
          {completed ? (
            <CircleCheck className="size-4 text-success" />
          ) : (
            <Circle className="size-4 text-muted-foreground hover:text-foreground" />
          )}
        </button>

        <button
          type="button"
          onClick={() => hasChildren && onToggle(node.id)}
          className={cn(hasChildren && 'cursor-pointer', completed && 'text-success line-through decoration-success/50')}
        >
          {node.title}
        </button>

        {node.description && <NoteIndicator note={node.description} />}

        {hasChildren && (
          <span className="font-mono text-xs text-muted-foreground">
            {completedCount}/{total}
          </span>
        )}

        <Tooltip>
          <TooltipTrigger render={<span className="inline-flex" />}>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="size-7 shrink-0" aria-label={`Actions for ${node.title}`} />
                }
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLogSessionOpen(true)} className="flex items-center gap-3">
                  <Clock className="size-4" />
                  Log a session
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAddChildOpen(true)} className="flex items-center gap-3">
                  <Plus className="size-4" />
                  Add sub-item
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRenameOpen(true)} className="flex items-center gap-3">
                  <Pencil className="size-4" />
                  Rename / edit notes
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)} className="flex items-center gap-3">
                  <Trash2 className="size-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </TooltipTrigger>
          <TooltipContent>More actions for this item</TooltipContent>
        </Tooltip>

        {hasChildren && (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="rounded px-1 text-xs text-muted-foreground hover:text-foreground"
            aria-label={collapsed ? 'Expand' : 'Collapse'}
          >
            {collapsed ? `+${node.children.length}` : '−'}
          </button>
        )}
      </div>

      {hasChildren && !collapsed && (
        <ul>
          {node.children.map((child) => (
            <OrgChartNode key={child.id} node={child} isCollapsed={isCollapsed} onToggle={onToggle} />
          ))}
        </ul>
      )}

      <ItemFormDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        mode="rename"
        itemId={node.id}
        initialTitle={node.title}
        initialDescription={node.description}
      />
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
