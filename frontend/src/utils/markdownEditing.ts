// Pure, framework-free text-editing helpers for the notes toolbar — no React
// import, so they're trivially testable on their own and don't care how the
// caller restores focus/selection afterward.

export interface EditResult {
  text: string
  selectionStart: number
  selectionEnd: number
}

/** Wraps the selection in a marker (e.g. `**` for bold) — inserts a pre-selected placeholder if nothing is selected. */
export function wrapSelection(value: string, start: number, end: number, marker: string, placeholder = ''): EditResult {
  const selected = value.slice(start, end)
  const content = selected || placeholder
  const text = value.slice(0, start) + marker + content + marker + value.slice(end)
  const selectionStart = start + marker.length
  return { text, selectionStart, selectionEnd: selectionStart + content.length }
}

/** Inserts a prefix at the start of the current line (e.g. "# " for a header). */
export function insertLinePrefix(value: string, start: number, end: number, prefix: string): EditResult {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1
  const text = value.slice(0, lineStart) + prefix + value.slice(lineStart)
  return { text, selectionStart: start + prefix.length, selectionEnd: end + prefix.length }
}

/**
 * Wraps the selection in a fenced code block (or inserts an empty one),
 * with the word "language" pre-selected right after the opening fence so
 * the user can type over it with an actual language (e.g. "js", "python")
 * — the fence's language tag, not syntax highlighting (this editor doesn't
 * highlight), but it's still useful for clarity and for any tool reading
 * the markdown later.
 */
export function insertCodeBlock(value: string, start: number, end: number): EditResult {
  const selected = value.slice(start, end)
  const body = selected ? `${selected}\n` : '\n'
  const text = value.slice(0, start) + '```language\n' + body + '```' + value.slice(end)
  return { text, selectionStart: start + 3, selectionEnd: start + 3 + 'language'.length }
}

/** Generic insertion at the cursor, replacing any current selection — used for images. */
export function insertAtCursor(
  value: string,
  start: number,
  end: number,
  insertText: string,
  selectFrom?: number,
  selectTo?: number,
): EditResult {
  const text = value.slice(0, start) + insertText + value.slice(end)
  const selectionStart = selectFrom !== undefined ? start + selectFrom : start + insertText.length
  const selectionEnd = selectTo !== undefined ? start + selectTo : selectionStart
  return { text, selectionStart, selectionEnd }
}
