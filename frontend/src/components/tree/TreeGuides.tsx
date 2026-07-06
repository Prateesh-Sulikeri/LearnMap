interface TreeGuidesProps {
  /** Nesting depth of the node these guides belong to (0 = root, no guides rendered). */
  depth: number
  /**
   * One entry per ancestor level above this node's parent (not including the
   * parent itself). `true` means that ancestor still has siblings below it,
   * so its vertical guide line must keep running through this node's row.
   */
  ancestorLines: boolean[]
  /** Whether this node is the last child among its siblings — if so, its own connector curves to a stop instead of continuing to the next sibling. */
  isLast: boolean
}

// Renders the connector lines for one tree row — shared by the editable
// Learning Tree and the read-only Dashboard progress tree. Must sit inside a
// `relative` ancestor that defines the `--indent` custom property (the
// per-depth-level width used for both padding and guide-column position).
//
// The elbow connecting a node to its parent is one bordered box (border-left
// + border-bottom + a rounded bottom-left corner), not two independently
// positioned line segments — a single box can't drift out of alignment with
// itself the way two separate absolutely-positioned elements can when
// neighboring rows differ slightly in height, and the rounded corner gives
// the last child's connector its curved ending for free.
export function TreeGuides({ depth, ancestorLines, isLast }: TreeGuidesProps) {
  if (depth === 0) return null

  const elbowLeft = `calc(${depth - 1} * var(--indent) + var(--indent) / 2)`

  return (
    <>
      {ancestorLines.map(
        (continues, i) =>
          continues && (
            <span
              key={i}
              aria-hidden
              className="absolute inset-y-0 w-px bg-tree-line"
              style={{ left: `calc(${i} * var(--indent) + var(--indent) / 2)` }}
            />
          ),
      )}

      {/* This node's own connector to its parent — curves at the bottom-left corner. */}
      <span
        aria-hidden
        className="absolute rounded-bl-lg border-b border-l border-tree-line"
        style={{ left: elbowLeft, top: 0, height: '50%', width: 'calc(var(--indent) / 2)' }}
      />

      {/* Continues straight down to the next sibling — omitted for the last child, so its elbow ends in the curve instead. */}
      {!isLast && (
        <span aria-hidden className="absolute w-px bg-tree-line" style={{ left: elbowLeft, top: '50%', bottom: 0 }} />
      )}
    </>
  )
}
