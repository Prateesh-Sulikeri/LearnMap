import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, ListTree, Maximize2, Minimize2, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import { itemsApi } from '@/services/itemsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import type { LearningTreeNode } from '@/utils/tree'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MarkdownToolbar } from '@/components/notes/MarkdownToolbar'
import { MarkdownPreview } from '@/components/notes/MarkdownPreview'

type EditorTab = 'write' | 'preview' | 'contents'

interface NotesEditorDialogProps {
  node: LearningTreeNode | null
  /** The top-level topic node's own id is currently editing — used for focus mode's side tree, which shows the whole topic, not just the current item's own children. */
  rootAncestor: LearningTreeNode | null
  onOpenChange: (open: boolean) => void
  onNavigate: (itemId: string) => void
}

// The single notes-editing surface for the whole Learning page — one dialog
// instance, driven by whichever node id the page currently has selected
// (rather than one dialog per tree row), so a table-of-contents entry can
// hand off to a different item's notes without any dialog-in-dialog nesting.
export function NotesEditorDialog({ node, rootAncestor, onOpenChange, onNavigate }: NotesEditorDialogProps) {
  const [value, setValue] = useState('')
  const [tab, setTab] = useState<EditorTab>('write')
  const [focusMode, setFocusMode] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const queryClient = useQueryClient()

  const hasContents = rootAncestor !== null && rootAncestor.children.length > 0

  useEffect(() => {
    if (node) {
      setValue(node.description ?? '')
      setTab('write')
    } else {
      // Dialog fully closed — start the next open at normal size.
      setFocusMode(false)
    }
    // Only the identity/content of the *currently selected* item should
    // reset the draft — an unrelated background refetch re-creating tree
    // node objects must not clobber in-progress typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id, node?.description])

  const save = useMutation({
    mutationFn: () => {
      if (!node) throw new Error('no item selected')
      return itemsApi.update(node.id, { description: value })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      toast.success('Note saved')
      onOpenChange(false)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  return (
    <Dialog open={node !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn('flex gap-0 overflow-hidden p-0', !focusMode && 'h-[85dvh] sm:max-w-xl lg:max-w-2xl')}
        // Focus mode uses an inline style, not Tailwind classes, to force
        // fullscreen — the base dialog sets sm:max-w-sm (a *variant*-scoped
        // class), which an unprefixed max-w-none override doesn't cancel
        // (tailwind-merge treats "sm:" as a separate bucket from unprefixed),
        // so the dialog silently stayed pinned to ~384px wide at >=640px
        // viewports. An inline style always wins regardless of that.
        style={
          focusMode
            ? { position: 'fixed', inset: 0, transform: 'none', width: '100vw', height: '100dvh', maxWidth: 'none', borderRadius: 0 }
            : undefined
        }
      >
        {/* Focus mode's persistent side tree — the whole topic (rootAncestor
            down), not just the current item's children, so every related
            note stays a click away while writing without leaving focus. */}
        {focusMode && rootAncestor && (
          <div className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-muted/30 p-4">
            <p className="mb-3 truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {rootAncestor.title}
            </p>
            <TableOfContents nodes={[rootAncestor]} onNavigate={onNavigate} activeId={node?.id} />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <DialogTitle className="min-w-0 truncate">{node?.title ?? 'Notes'}</DialogTitle>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      onClick={() => {
                        const next = !focusMode
                        setFocusMode(next)
                        if (next) setTab('preview')
                      }}
                    />
                  }
                >
                  {focusMode ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
                </TooltipTrigger>
                <TooltipContent>{focusMode ? 'Exit focus mode' : 'Focus mode'}</TooltipContent>
              </Tooltip>
            </div>
            <DialogDescription>Markdown supported — headers, bold/italic, code blocks, and images.</DialogDescription>
          </DialogHeader>

          <div className="flex w-fit shrink-0 items-center gap-1 rounded-lg border border-border p-0.5">
            <TabButton active={tab === 'write'} onClick={() => setTab('write')}>
              <PenLine className="size-4" />
              Write
            </TabButton>
            <TabButton active={tab === 'preview'} onClick={() => setTab('preview')}>
              <Eye className="size-4" />
              Preview
            </TabButton>
            {!focusMode && hasContents && (
              <TabButton active={tab === 'contents'} onClick={() => setTab('contents')}>
                <ListTree className="size-4" />
                Contents
              </TabButton>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === 'write' && (
              <div className="flex h-full min-h-48 flex-col">
                <MarkdownToolbar textareaRef={textareaRef} value={value} onChange={setValue} />
                <Textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Write your notes… headers, **bold**, *italic*, code blocks, images — like a short blog post."
                  className="field-sizing-fixed h-full resize-none overflow-y-auto rounded-t-none font-mono text-sm"
                />
              </div>
            )}
            {tab === 'preview' && (
              <div className="h-full overflow-y-auto rounded-lg border border-border p-4">
                <MarkdownPreview source={value} />
              </div>
            )}
            {tab === 'contents' && !focusMode && rootAncestor && (
              <div className="h-full overflow-y-auto rounded-lg border border-border p-4">
                <TableOfContents nodes={[rootAncestor]} onNavigate={onNavigate} activeId={node?.id} />
              </div>
            )}
          </div>

          <DialogFooter className={cn(focusMode && 'rounded-none')}>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn('gap-1.5', active && 'bg-accent text-accent-foreground')}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

// Auto-generated from the item's own sub-tree — a topic's notes double as a
// table of contents, each entry a "hyperlink" (a hand-off to another
// NotesEditorDialog target, not a real URL) into that sub-topic's own notes.
function TableOfContents({
  nodes,
  onNavigate,
  activeId,
}: {
  nodes: LearningTreeNode[]
  onNavigate: (id: string) => void
  activeId?: string
}) {
  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">No sub-topics yet.</p>
  }
  return (
    <ul className="space-y-1.5">
      {nodes.map((node) => (
        <TOCEntry key={node.id} node={node} onNavigate={onNavigate} activeId={activeId} />
      ))}
    </ul>
  )
}

function TOCEntry({
  node,
  onNavigate,
  activeId,
}: {
  node: LearningTreeNode
  onNavigate: (id: string) => void
  activeId?: string
}) {
  const isActive = node.id === activeId
  return (
    <li>
      <button
        type="button"
        onClick={() => onNavigate(node.id)}
        className={cn(
          'text-left text-sm hover:underline',
          isActive ? 'font-semibold text-foreground' : 'text-accent-hover',
          node.status === 'completed' && 'text-success line-through decoration-success/50',
        )}
      >
        {node.title}
      </button>
      {node.children.length > 0 && (
        <ul className="mt-1.5 space-y-1.5 border-l border-border pl-4">
          {node.children.map((child) => (
            <TOCEntry key={child.id} node={child} onNavigate={onNavigate} activeId={activeId} />
          ))}
        </ul>
      )}
    </li>
  )
}
