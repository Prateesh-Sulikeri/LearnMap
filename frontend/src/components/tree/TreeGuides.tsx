interface TreeGuidesProps {
  /** Nesting depth of the node these guides belong to (0 = root, no guides rendered). */
  depth: number
  /**
   * One entry per ancestor level above this node's parent (not including the
   * parent itself). `true` means that ancestor still has siblings below it,
   * so its vertical guide line must keep running through this node's row.
   */
  ancestorLines: boolean[]
  /** Whether this node is the last child among its siblings — if so, its own connector stops halfway instead of running the full row height. */
  isLast: boolean
}

// Renders the vertical/elbow connector lines for one tree row — shared by
// the editable Learning Tree and the read-only Dashboard progress tree so
// both render identical "real tree" visuals. Must be placed inside a
// `relative` ancestor that defines the `--indent` custom property (the
// per-depth-level width used for both padding and guide-column position).
export function TreeGuides({ depth, ancestorLines, isLast }: TreeGuidesProps) {
  if (depth === 0) return null

  return (
    <>
      {ancestorLines.map(
        (continues, i) =>
          continues && (
            <span
              key={i}
              aria-hidden
              className="absolute inset-y-0 w-px bg-border"
              style={{ left: `calc(${i} * var(--indent) + var(--indent) / 2)` }}
            />
          ),
      )}
      <span
        aria-hidden
        className="absolute w-px bg-border"
        style={{
          left: `calc(${depth - 1} * var(--indent) + var(--indent) / 2)`,
          top: 0,
          height: isLast ? '50%' : '100%',
        }}
      />
      <span
        aria-hidden
        className="absolute h-px bg-border"
        style={{
          left: `calc(${depth - 1} * var(--indent) + var(--indent) / 2)`,
          width: 'calc(var(--indent) / 2)',
          top: '50%',
        }}
      />
    </>
  )
}
