import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, ListTree, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import { itemsApi } from '@/services/itemsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import type { LearningTreeNode } from '@/utils/tree'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MarkdownToolbar } from '@/components/notes/MarkdownToolbar'
import { MarkdownPreview } from '@/components/notes/MarkdownPreview'

type EditorTab = 'write' | 'preview' | 'contents'

interface NotesEditorDialogProps {
  node: LearningTreeNode | null
  onOpenChange: (open: boolean) => void
  onNavigate: (itemId: string) => void
}

// The single notes-editing surface for the whole Learning page — one dialog
// instance, driven by whichever node id the page currently has selected
// (rather than one dialog per tree row), so a table-of-contents entry can
// hand off to a different item's notes without any dialog-in-dialog nesting.
export function NotesEditorDialog({ node, onOpenChange, onNavigate }: NotesEditorDialogProps) {
  const [value, setValue] = useState('')
  const [tab, setTab] = useState<EditorTab>('write')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const queryClient = useQueryClient()

  const isRootWithChildren = node !== null && node.parent_id === null && node.children.length > 0

  useEffect(() => {
    if (node) {
      setValue(node.description ?? '')
      setTab('write')
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
      <DialogContent className="flex h-[85dvh] flex-col overflow-hidden sm:max-w-xl lg:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{node?.title ?? 'Notes'}</DialogTitle>
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
          {isRootWithChildren && (
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
          {tab === 'contents' && node && (
            <div className="h-full overflow-y-auto rounded-lg border border-border p-4">
              <TableOfContents nodes={node.children} onNavigate={onNavigate} />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
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

// Auto-generated from the item's own sub-tree — a root topic's notes double
// as a table of contents, each entry a "hyperlink" (a hand-off to another
// NotesEditorDialog target, not a real URL) into that sub-topic's own notes.
function TableOfContents({ nodes, onNavigate }: { nodes: LearningTreeNode[]; onNavigate: (id: string) => void }) {
  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">No sub-topics yet.</p>
  }
  return (
    <ul className="space-y-1.5">
      {nodes.map((node) => (
        <TOCEntry key={node.id} node={node} onNavigate={onNavigate} />
      ))}
    </ul>
  )
}

function TOCEntry({ node, onNavigate }: { node: LearningTreeNode; onNavigate: (id: string) => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onNavigate(node.id)}
        className={cn(
          'text-left text-sm text-accent-hover hover:underline',
          node.status === 'completed' && 'text-success line-through decoration-success/50',
        )}
      >
        {node.title}
      </button>
      {node.children.length > 0 && (
        <ul className="mt-1.5 space-y-1.5 border-l border-border pl-4">
          {node.children.map((child) => (
            <TOCEntry key={child.id} node={child} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  )
}
