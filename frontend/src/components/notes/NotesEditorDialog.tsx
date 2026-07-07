import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Circle,
  CircleCheck,
  Clock,
  Download,
  Eye,
  ListTree,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  PenLine,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { itemsApi } from '@/services/itemsApi'
import { getApiErrorMessage } from '@/utils/apiError'
import type { LearningTreeNode } from '@/utils/tree'
import { computeNumbering, flattenPreOrder } from '@/utils/treeNumbering'
import { exportNoteAsMarkdown, exportTopicAsMarkdown } from '@/utils/noteExport'
import { cn } from '@/lib/utils'
import { NumberBadge } from '@/components/tree/NumberBadge'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MarkdownToolbar } from '@/components/notes/MarkdownToolbar'
import { MarkdownPreview } from '@/components/notes/MarkdownPreview'
import { ItemFormDialog } from '@/components/ItemFormDialog'
import { AddSessionDialog } from '@/components/AddSessionDialog'

type EditorTab = 'write' | 'preview' | 'contents'

interface NotesEditorDialogProps {
  node: LearningTreeNode | null
  /** The top-level topic containing the current item — focus mode's side tree shows this whole topic, not just the current item's own children. */
  rootAncestor: LearningTreeNode | null
  onOpenChange: (open: boolean) => void
  onNavigate: (itemId: string) => void
}

// The single notes-editing surface for the whole Learning page — one dialog
// instance, driven by whichever node id the page currently has selected
// (rather than one dialog per tree row), so a table-of-contents entry can
// hand off to a different item's notes without any dialog-in-dialog nesting.
//
// Focus mode does NOT render through the normal Dialog/DialogContent at
// all — it's a plain `position: fixed` div rendered via a portal straight
// onto document.body. Two earlier attempts tried to force DialogContent's
// own Base UI Popup element to fullscreen (first via Tailwind classes,
// then via an inline style), and both were still constrained by the
// primitive's own layout behavior in practice. A portal sidesteps that
// entirely: nothing about Base UI's Dialog positioning is involved, so
// there's nothing for it to fight.
export function NotesEditorDialog({ node, rootAncestor, onOpenChange, onNavigate }: NotesEditorDialogProps) {
  const [value, setValue] = useState('')
  const [tab, setTab] = useState<EditorTab>('write')
  const [focusMode, setFocusMode] = useState(false)
  const [sideTreeCollapsed, setSideTreeCollapsed] = useState(false)
  const [addChildOpen, setAddChildOpen] = useState(false)
  const [logSessionOpen, setLogSessionOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const queryClient = useQueryClient()

  const isOpen = node !== null
  const hasContents = rootAncestor !== null && rootAncestor.children.length > 0
  const completed = node?.status === 'completed'
  const isDirty = node !== null && value !== (node.description ?? '')
  const topicNumbering = rootAncestor ? computeNumbering([rootAncestor]) : new Map<string, string>()
  const topicFlat = rootAncestor ? flattenPreOrder([rootAncestor]) : []

  useEffect(() => {
    if (node) {
      setValue(node.description ?? '')
      setTab('write')
    } else {
      // Dialog fully closed — start the next open at normal size.
      setFocusMode(false)
      setSideTreeCollapsed(false)
    }
    // Deliberately keyed on id only, not description: auto-save below
    // triggers a background refetch of the same item after every save,
    // which would otherwise re-fire this effect and yank the user back to
    // the Write tab (and reset an in-flight keystroke) after every
    // autosave. Switching to a genuinely different item still resets
    // correctly since that changes node?.id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id])

  // Escape backs out of focus mode first, then the dialog's normal Escape
  // handling (Base UI's, for the non-focus-mode case) takes over.
  useEffect(() => {
    if (!focusMode) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFocusMode(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [focusMode])

  const save = useMutation({
    mutationFn: () => {
      if (!node) throw new Error('no item selected')
      return itemsApi.update(node.id, { description: value })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      toast.success('Note saved')
      // In focus mode, Save persists without leaving — that's the point of
      // staying focused. Outside focus mode it still saves-and-closes, the
      // conventional dialog pattern.
      if (!focusMode) onOpenChange(false)
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  // Silent counterpart to `save` — no toast, never closes anything. Idle
  // auto-save firing every few seconds shouldn't announce itself or
  // interrupt whatever the user is doing.
  const autoSave = useMutation({
    mutationFn: (description: string) => {
      if (!node) throw new Error('no item selected')
      return itemsApi.update(node.id, { description })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
    },
  })

  // Auto-save after a short idle period so work is never lost to a
  // forgotten Save click — silent, and only while there's actually
  // something unsaved to write.
  useEffect(() => {
    if (!isDirty) return
    const timer = setTimeout(() => autoSave.mutate(value), 2500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, isDirty])

  // Ctrl/Cmd+S saves instead of triggering the browser's own Save Page.
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        if (isDirty) save.mutate()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isDirty])

  // Any way of closing (Cancel, backdrop click, Escape) saves first if
  // there's unsaved work — the whole point of auto-save is that work is
  // never lost, including by closing without clicking Save.
  const closeAndMaybeSave = (open: boolean) => {
    if (!open && isDirty && node) {
      itemsApi
        .update(node.id, { description: value })
        .then(() => queryClient.invalidateQueries({ queryKey: ['items'] }))
        .catch(() => toast.error("Couldn't save your note before closing"))
    }
    onOpenChange(open)
  }

  const toggleStatus = useMutation({
    mutationFn: () => {
      if (!node) throw new Error('no item selected')
      return itemsApi.setStatus(node.id, { status: completed ? 'in_progress' : 'completed' })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['items'] })
      toast.success(completed ? 'Reopened' : 'Marked complete')
    },
    onError: (err: unknown) => toast.error(getApiErrorMessage(err)),
  })

  const enterFocusMode = () => {
    setFocusMode(true)
    setSideTreeCollapsed(false)
    setTab('preview')
  }

  const body = (
    <>
      {focusMode && rootAncestor && !sideTreeCollapsed && (
        <div className="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="truncate text-xs font-semibold tracking-wide text-muted-foreground uppercase">{rootAncestor.title}</p>
            <Tooltip>
              <TooltipTrigger
                render={<Button type="button" variant="ghost" size="icon-sm" onClick={() => setSideTreeCollapsed(true)} />}
              >
                <PanelLeftClose className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>Collapse</TooltipContent>
            </Tooltip>
          </div>
          <TableOfContents nodes={[rootAncestor]} onNavigate={onNavigate} activeId={node?.id} numbering={topicNumbering} />
        </div>
      )}

      {/* Collapsed: a thin rail of just the numbered badges, still clickable, rather than losing navigation entirely. */}
      {focusMode && rootAncestor && sideTreeCollapsed && (
        <div className="flex w-12 shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-border bg-muted/30 py-4">
          {topicFlat.map((entry) => (
            <Tooltip key={entry.id}>
              <TooltipTrigger
                render={
                  <button type="button" onClick={() => onNavigate(entry.id)} className="rounded-full transition-transform hover:scale-110" />
                }
              >
                <NumberBadge
                  label={topicNumbering.get(entry.id) ?? ''}
                  className={cn(
                    entry.id === node?.id && 'bg-primary text-primary-foreground',
                    entry.status === 'completed' && entry.id !== node?.id && 'bg-success/15 text-success-text',
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="right">{entry.title}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-4">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {focusMode && rootAncestor && sideTreeCollapsed && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button type="button" variant="ghost" size="icon-sm" className="shrink-0" onClick={() => setSideTreeCollapsed(false)} />
                  }
                >
                  <PanelLeftOpen className="size-4" />
                </TooltipTrigger>
                <TooltipContent>Show contents</TooltipContent>
              </Tooltip>
            )}
            <button
              type="button"
              onClick={() => node && toggleStatus.mutate()}
              disabled={!node || toggleStatus.isPending}
              aria-label={completed ? 'Reopen' : 'Mark complete'}
              className="shrink-0 transition-transform duration-150 active:scale-90"
            >
              {completed ? (
                <CircleCheck className="size-5 text-success" />
              ) : (
                <Circle className="size-5 text-muted-foreground hover:text-foreground" />
              )}
            </button>
            <p
              className={cn(
                'min-w-0 flex-1 truncate font-heading text-base leading-none font-medium',
                completed && 'text-success-text line-through decoration-success-text/50',
              )}
            >
              {node?.title ?? 'Notes'}
            </p>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="shrink-0"
                    onClick={() => (focusMode ? setFocusMode(false) : enterFocusMode())}
                  />
                }
              >
                {focusMode ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </TooltipTrigger>
              <TooltipContent>{focusMode ? 'Exit focus mode' : 'Focus mode'}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<span className="inline-flex shrink-0" />}>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon-sm" aria-label="More actions" disabled={!node} />
                    }
                  >
                    <MoreHorizontal className="size-4" />
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
                    <DropdownMenuItem
                      onClick={() => node && exportNoteAsMarkdown({ ...node, description: value })}
                      className="flex items-center gap-3"
                    >
                      <Download className="size-4" />
                      Export this note (.md)
                    </DropdownMenuItem>
                    {rootAncestor && (
                      <DropdownMenuItem
                        onClick={() => exportTopicAsMarkdown(rootAncestor)}
                        className="flex items-center gap-3"
                      >
                        <Download className="size-4" />
                        Export whole topic (.md)
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TooltipTrigger>
              <TooltipContent>More actions</TooltipContent>
            </Tooltip>
          </div>
          {tab === 'write' && (
            <p className="text-sm text-muted-foreground">Markdown supported — headers, bold/italic, code blocks, and images.</p>
          )}
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
              <TableOfContents nodes={[rootAncestor]} onNavigate={onNavigate} activeId={node?.id} numbering={topicNumbering} />
            </div>
          )}
        </div>

        <DialogFooter className={cn(focusMode && 'rounded-none')}>
          <Button variant="outline" onClick={() => closeAndMaybeSave(false)}>
            {isDirty ? 'Save & Close' : 'Cancel'}
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !isDirty}>
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </div>
    </>
  )

  // Rendered regardless of focus mode, so these actions work from either.
  const nodeScopedDialogs = node && (
    <>
      <ItemFormDialog open={addChildOpen} onOpenChange={setAddChildOpen} mode="create" parentId={node.id} />
      <AddSessionDialog open={logSessionOpen} onOpenChange={setLogSessionOpen} defaultItemId={node.id} />
    </>
  )

  if (focusMode) {
    if (!isOpen) return null
    return createPortal(
      <>
        <div className="fixed inset-0 z-50 flex bg-popover text-popover-foreground">{body}</div>
        {nodeScopedDialogs}
      </>,
      document.body,
    )
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={closeAndMaybeSave}>
        <DialogContent showCloseButton={false} className="flex h-[85dvh] gap-0 overflow-hidden p-0 sm:max-w-xl lg:max-w-2xl">
          {body}
        </DialogContent>
      </Dialog>
      {nodeScopedDialogs}
    </>
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
  numbering,
}: {
  nodes: LearningTreeNode[]
  onNavigate: (id: string) => void
  activeId?: string
  numbering: Map<string, string>
}) {
  if (nodes.length === 0) {
    return <p className="text-sm text-muted-foreground">No sub-topics yet.</p>
  }
  return (
    <ul className="space-y-1.5">
      {nodes.map((node) => (
        <TOCEntry key={node.id} node={node} onNavigate={onNavigate} activeId={activeId} numbering={numbering} />
      ))}
    </ul>
  )
}

function TOCEntry({
  node,
  onNavigate,
  activeId,
  numbering,
}: {
  node: LearningTreeNode
  onNavigate: (id: string) => void
  activeId?: string
  numbering: Map<string, string>
}) {
  const isActive = node.id === activeId
  return (
    <li>
      <button
        type="button"
        onClick={() => onNavigate(node.id)}
        className={cn(
          'flex items-center gap-1.5 text-left text-sm hover:underline',
          isActive ? 'font-semibold text-foreground' : 'text-accent-hover',
          node.status === 'completed' && 'text-success-text line-through decoration-success-text/50',
        )}
      >
        <NumberBadge label={numbering.get(node.id) ?? ''} />
        {node.title}
      </button>
      {node.children.length > 0 && (
        <ul className="mt-1.5 space-y-1.5 border-l border-border pl-4">
          {node.children.map((child) => (
            <TOCEntry key={child.id} node={child} onNavigate={onNavigate} activeId={activeId} numbering={numbering} />
          ))}
        </ul>
      )}
    </li>
  )
}
