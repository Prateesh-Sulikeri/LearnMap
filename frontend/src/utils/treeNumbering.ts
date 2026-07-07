import type { LearningTreeNode } from '@/utils/tree'

// Alternates numeric/lowercase-alpha per depth: 1, 1a, 1a1, 1a1a, ... — the
// design doc's example only showed two levels (1, 1a/1b); this generalizes
// the same "digits swap style each level" idea to arbitrary depth.
function segmentFor(index: number, depth: number): string {
  if (depth % 2 === 0) return String(index + 1)
  // Spreadsheet-column-style letters: a, b, ..., z, aa, ab, ...
  let n = index
  let label = ''
  do {
    label = String.fromCharCode(97 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

/** Computes a "1"/"1a"/"1a1"-style label for every node in a forest, keyed by node id. */
export function computeNumbering(roots: LearningTreeNode[]): Map<string, string> {
  const labels = new Map<string, string>()
  function walk(nodes: LearningTreeNode[], prefix: string, depth: number) {
    nodes.forEach((node, index) => {
      const label = prefix + segmentFor(index, depth)
      labels.set(node.id, label)
      walk(node.children, label, depth + 1)
    })
  }
  walk(roots, '', 0)
  return labels
}

/** Flattens a forest into the same depth-first, sibling order `computeNumbering` labels in — used to render a flat rail of numbered entries. */
export function flattenPreOrder(roots: LearningTreeNode[]): LearningTreeNode[] {
  const result: LearningTreeNode[] = []
  function walk(nodes: LearningTreeNode[]) {
    for (const node of nodes) {
      result.push(node)
      walk(node.children)
    }
  }
  walk(roots)
  return result
}
