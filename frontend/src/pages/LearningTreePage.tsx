import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleCheck, List, ListTree, NotepadText, Search, Star, Trash2, Workflow, X } from 'lucide-react'
import { useLearningTree } from '@/hooks/useLearningTree'
import { useCollapsedState } from '@/hooks/useCollapsedState'
import { useTreeViewMode } from '@/hooks/useTreeViewMode'
import { findNodeById, findRootContaining, nodeMatchesSearch } from '@/utils/tree'
import { flattenPreOrder } from '@/utils/treeNumbering'
import { TreeNode } from '@/components/TreeNode'
import { OrgChartTree } from '@/components/tree/OrgChartTree'
import { FavoritesList } from '@/components/tree/FavoritesList'
import { NotesEditorDialog } from '@/components/notes/NotesEditorDialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type MapTab = 'active' | 'completed' | 'favs'

export default function LearningTreePage() {
  // Tab and search live in the URL (not local state) so the breadcrumb in
  // AppLayout can link to a specific tab/search — "Learning / Completed" or
  // "Learning / Backend" as real, shareable, back-button-friendly links.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: MapTab = tabParam === 'completed' ? 'completed' : tabParam === 'favs' ? 'favs' : 'active'
  const searchQuery = searchParams.get('q') ?? ''
  const setTab = (next: MapTab) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      if (next === 'active') params.delete('tab')
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

  // Active shows everything, unfiltered. Completed is the old behavior —
  // only a completed *top-level* topic moves there (a completed sub-item
  // under a still-active parent stays put, since the parent as a whole
  // isn't done). Favs is a flat cut across the whole tree at any depth, not
  // a root-level filter — a favorite can be a deeply-nested sub-item.
  const completedCount = tree.filter((node) => node.status === 'completed').length
  const favoriteFlat = flattenPreOrder(tree).filter((node) => node.is_favorite)
  const tabTree = tab === 'completed' ? tree.filter((node) => node.status === 'completed') : tree

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const visibleTree = trimmedQuery ? tabTree.filter((node) => nodeMatchesSearch(node, trimmedQuery)) : tabTree
  const visibleFavorites = trimmedQuery
    ? favoriteFlat.filter((node) => node.title.toLowerCase().includes(trimmedQuery))
    : favoriteFlat

  return (
    <div className="space-y-4">
      <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border p-0.5 md:w-fit">
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
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn('gap-1.5', tab === 'favs' && 'bg-accent text-accent-foreground')}
          onClick={() => setTab('favs')}
        >
          <Star className="size-4" />
          Favs
          {favoriteFlat.length > 0 && <span className="font-mono text-xs text-muted-foreground">{favoriteFlat.length}</span>}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
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

        {tab !== 'favs' && (
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
        )}

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

      {tab === 'favs' ? (
        favoriteFlat.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing favorited yet — hover an item in Active or Completed and tap the star to add it here.
          </p>
        ) : visibleFavorites.length === 0 ? (
          <p className="text-sm text-muted-foreground">No favorites match &quot;{searchQuery}&quot;.</p>
        ) : (
          <FavoritesList items={visibleFavorites} onOpenNotes={setNotesItemId} />
        )
      ) : tabTree.length === 0 ? (
        <p className="text-sm text-muted-foreground">You haven&apos;t completed any top-level topics yet.</p>
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
