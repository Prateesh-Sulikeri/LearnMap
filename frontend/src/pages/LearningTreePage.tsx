import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleCheck, List, ListTree, NotepadText, Search, Star, Trash2, Workflow, X } from 'lucide-react'
import { useLearningTree } from '@/hooks/useLearningTree'
import { useCollapsedState } from '@/hooks/useCollapsedState'
import { useTreeViewMode } from '@/hooks/useTreeViewMode'
import { collectFavoriteRoots, findNodeById, findRootContaining, nodeMatchesSearch } from '@/utils/tree'
import { TreeNode } from '@/components/TreeNode'
import { OrgChartTree } from '@/components/tree/OrgChartTree'
import { NotesEditorDialog } from '@/components/notes/NotesEditorDialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type MapTab = 'favs' | 'active' | 'completed'

const EMPTY_TAB_MESSAGE: Record<MapTab, string> = {
  favs: 'Nothing favorited yet — hover any item and tap the star to add it here.',
  active: 'Nothing here yet.',
  completed: "You haven't completed any top-level topics yet.",
}

export default function LearningTreePage() {
  // Tab and search live in the URL (not local state) so the breadcrumb in
  // AppLayout can link to a specific tab/search — "Learning / Completed" or
  // "Learning / Backend" as real, shareable, back-button-friendly links.
  // Favs is the default (no ?tab= param), matching how most users want to
  // land on what they've flagged as important rather than everything active.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: MapTab = tabParam === 'active' ? 'active' : tabParam === 'completed' ? 'completed' : 'favs'
  const searchQuery = searchParams.get('q') ?? ''
  const setTab = (next: MapTab) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === 'favs') params.delete('tab')
      else params.set('tab', next)
      return params
    })
  }
  const setSearchQuery = (next: string) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next) params.set('q', next)
      else params.delete('q')
      return params
    })
  }
  const [viewMode, setViewMode] = useTreeViewMode()
  const [notesItemId, setNotesItemId] = useState<string | null>(null)
  const { tree, isLoading, isError } = useLearningTree()
  const { isCollapsed, toggle } = useCollapsedState()

  // A single shared dialog instance, not one per tree row — lets a
  // table-of-contents entry inside the dialog hand off to a different
  // item's notes without any dialog-in-dialog nesting.
  const notesNode = notesItemId ? findNodeById(tree, notesItemId) : null
  // Focus mode's side tree is rooted at the whole topic (the top-level
  // ancestor), not just the current item's own children — so every
  // related note stays reachable while writing, not just its direct kids.
  const notesRootAncestor = notesItemId ? findRootContaining(tree, notesItemId) : null

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

  // A completed root topic is no longer "active" — it moves to Completed
  // and drops out of Favs too if it was favorited there (still reachable
  // via Completed; not deleted, not unfavorited, just not surfaced here).
  const activeRoots = tree.filter((node) => node.status !== 'completed')
  const completedRoots = tree.filter((node) => node.status === 'completed')
  // Any node can be favorited, not just a root — a favorited node shows as
  // its own standalone entry (itself + its own descendants) here,
  // independent of its ancestors, per collectFavoriteRoots.
  const favoriteRoots = collectFavoriteRoots(tree).filter((node) => node.status !== 'completed')

  const completedCount = completedRoots.length
  const favoriteCount = favoriteRoots.length
  const tabTree = tab === 'completed' ? completedRoots : tab === 'favs' ? favoriteRoots : activeRoots

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const visibleTree = trimmedQuery ? tabTree.filter((node) => nodeMatchesSearch(node, trimmedQuery)) : tabTree

  return (
    <div className="space-y-4">
      {/* Title row: page identity + page-level utility actions (view mode,
          trash) — these apply regardless of which tab/search is active. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">Learning</h1>
        <div className="flex items-center gap-2">
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
                  className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-destructive transition-colors duration-150 hover:bg-destructive/10"
                />
              }
            >
              <Trash2 className="size-4" />
            </TooltipTrigger>
            <TooltipContent>View and restore deleted items</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Tabs + search row: both scope "which items am I looking at," so
          they're grouped together on their own row below the title. */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border p-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('gap-1.5', tab === 'favs' && 'bg-accent text-accent-foreground')}
            onClick={() => setTab('favs')}
          >
            <Star className="size-4" />
            Favs
            {favoriteCount > 0 && <span className="font-mono text-xs text-muted-foreground">{favoriteCount}</span>}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('gap-1.5', tab === 'active' && 'bg-accent text-accent-foreground')}
            onClick={() => setTab('active')}
          >
            <NotepadText className="size-4" />
            Active
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn('gap-1.5', tab === 'completed' && 'bg-accent text-accent-foreground')}
            onClick={() => setTab('completed')}
          >
            <CircleCheck className="size-4" />
            Completed
            {completedCount > 0 && <span className="font-mono text-xs text-muted-foreground">{completedCount}</span>}
          </Button>
        </div>

        {/* min-w-48, not just flex-1 — flex-wrap only kicks in once an item
            can't shrink further; without a floor, this box just shrinks to
            an illegibly narrow sliver instead of wrapping onto its own row. */}
        <div className="relative min-w-48 max-w-sm flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search your learning items…"
            className="pl-8 pr-8"
            aria-label="Search"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute top-1/2 right-2 flex size-5 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {tabTree.length === 0 ? (
        <p className="text-sm text-muted-foreground">{EMPTY_TAB_MESSAGE[tab]}</p>
      ) : visibleTree.length === 0 ? (
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
              onOpenNotes={setNotesItemId}
              isLast={index === visibleTree.length - 1}
              ancestorLines={[]}
            />
          ))}
        </ul>
      ) : (
        <OrgChartTree tree={visibleTree} isCollapsed={isCollapsed} onToggle={toggle} onOpenNotes={setNotesItemId} />
      )}

      <NotesEditorDialog
        node={notesNode}
        rootAncestor={notesRootAncestor}
        onOpenChange={(open) => !open && setNotesItemId(null)}
        onNavigate={setNotesItemId}
      />
    </div>
  )
}
