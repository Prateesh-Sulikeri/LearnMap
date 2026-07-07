import type { LearningItem } from '@/types/api'

export interface LearningTreeNode extends LearningItem {
  children: LearningTreeNode[]
}

/**
 * Assembles the flat, parent_id-linked list the API returns into a nested
 * tree, client-side (ADR-001) — the backend deliberately doesn't do this
 * server-side since the dataset is small and it's a trivial, testable pure
 * function here.
 */
export function buildTree(items: LearningItem[]): LearningTreeNode[] {
  const nodeById = new Map<string, LearningTreeNode>()
  for (const item of items) {
    nodeById.set(item.id, { ...item, children: [] })
  }

  const roots: LearningTreeNode[] = []
  for (const item of items) {
    const node = nodeById.get(item.id)
    if (!node) continue
    const parent = item.parent_id ? nodeById.get(item.parent_id) : undefined
    if (parent) {
      parent.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

/** True if this node's title matches, or any descendant's does (so a match deep in the tree keeps its ancestors visible). */
export function nodeMatchesSearch(node: LearningTreeNode, query: string): boolean {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return true
  if (node.title.toLowerCase().includes(trimmed)) return true
  return node.children.some((child) => nodeMatchesSearch(child, trimmed))
}

/** Depth-first search for a node by id across a forest — used to resolve which item the notes dialog is currently showing. */
export function findNodeById(roots: LearningTreeNode[], id: string): LearningTreeNode | null {
  for (const node of roots) {
    if (node.id === id) return node
    const found = findNodeById(node.children, id)
    if (found) return found
  }
  return null
}

function containsId(node: LearningTreeNode, id: string): boolean {
  if (node.id === id) return true
  return node.children.some((child) => containsId(child, id))
}

/** Finds which top-level root's subtree contains the given id — used by the notes editor's focus mode to show the whole topic's tree, not just the current item's own children. */
export function findRootContaining(roots: LearningTreeNode[], id: string): LearningTreeNode | null {
  return roots.find((root) => containsId(root, id)) ?? null
}

/**
 * Any node can be favorited, not just a top-level topic. A favorited node
 * displays as its own standalone entry (itself + its own descendants),
 * independent of its ancestors — so favoriting a deeply-nested node with
 * children shows just that node's subtree in the Favs tab, not the whole
 * original topic it lives in.
 *
 * Walks top-down: once a favorited node is found, its descendants are NOT
 * searched further, even if one of them is also favorited — a nested
 * favorite is already visible within its favorited ancestor's own subtree,
 * so surfacing it again as a second, separate top-level entry would just
 * duplicate it.
 */
export function collectFavoriteRoots(nodes: LearningTreeNode[]): LearningTreeNode[] {
  const result: LearningTreeNode[] = []
  for (const node of nodes) {
    if (node.is_favorite) {
      result.push(node)
    } else {
      result.push(...collectFavoriteRoots(node.children))
    }
  }
  return result
}

export interface CompletionCount {
  completed: number
  total: number
}

/** Counts completed vs. total nodes across this node and its whole subtree — used for the Dashboard's progress tree badges. */
export function countCompletion(node: LearningTreeNode): CompletionCount {
  return node.children.reduce(
    (acc, child) => {
      const childCount = countCompletion(child)
      return { completed: acc.completed + childCount.completed, total: acc.total + childCount.total }
    },
    { completed: node.status === 'completed' ? 1 : 0, total: 1 },
  )
}
