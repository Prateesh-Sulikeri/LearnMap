import type { LearningTreeNode } from '@/utils/tree'
import { OrgChartNode } from '@/components/tree/OrgChartNode'
import './org-chart.css'

interface OrgChartTreeProps {
  tree: LearningTreeNode[]
  isCollapsed: (id: string) => boolean
  onToggle: (id: string) => void
  onOpenNotes: (id: string) => void
}

// A literal top-down tree diagram (root at top, children spreading out
// below, connected by lines) — a different visual job than the indented
// list: a quick, spatial "shape of my progress" glance rather than dense
// editing. Multiple top-level topics each get their own independent
// diagram, laid out left to right; the whole thing scrolls horizontally on
// its own so a wide or deep map never breaks the page layout.
export function OrgChartTree({ tree, isCollapsed, onToggle, onOpenNotes }: OrgChartTreeProps) {
  return (
    // min-h-[60vh] keeps the scroll area reliably tall regardless of how
    // shallow the tree is, so the horizontal scrollbar consistently sits
    // near the bottom of the viewport instead of immediately below a short
    // diagram — a single root with no children looked jarring otherwise.
    <div className="w-full min-h-[60vh] overflow-x-auto pb-2">
      <div className="flex w-max min-w-full justify-center gap-10 px-2">
        {tree.map((root) => (
          <ul key={root.id} className="org-tree">
            <OrgChartNode node={root} isCollapsed={isCollapsed} onToggle={onToggle} onOpenNotes={onOpenNotes} isRoot />
          </ul>
        ))}
      </div>
    </div>
  )
}
