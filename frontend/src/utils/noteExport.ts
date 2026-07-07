import type { LearningTreeNode } from '@/utils/tree'
import { computeNumbering } from '@/utils/treeNumbering'

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  )
}

function anchor(label: string, title: string): string {
  return slugify(`${label}-${title}`)
}

function downloadMarkdown(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

/** Exports a single item's notes as a standalone .md file. */
export function exportNoteAsMarkdown(node: LearningTreeNode) {
  const body = node.description?.trim() ? node.description : '_No notes yet._'
  downloadMarkdown(`${slugify(node.title)}.md`, `# ${node.title}\n\n${body}\n`)
}

/**
 * Exports a whole topic (the root plus every descendant) as one combined
 * .md file — a table of contents up top with anchor links, then each
 * item's notes as its own section. A single flowing document rather than a
 * .zip of separate files: no new dependency needed to produce it, and it's
 * still a perfectly normal way to bundle a "notebook" of markdown notes.
 */
export function exportTopicAsMarkdown(root: LearningTreeNode) {
  const numbering = computeNumbering([root])

  const tocLines: string[] = []
  const sections: string[] = []
  function walk(node: LearningTreeNode, depth: number) {
    const label = numbering.get(node.id) ?? ''
    tocLines.push(`${'  '.repeat(depth)}- [${label}. ${node.title}](#${anchor(label, node.title)})`)
    const body = node.description?.trim() ? node.description : '_No notes yet._'
    sections.push(`## ${label}. ${node.title}\n\n${body}`)
    for (const child of node.children) walk(child, depth + 1)
  }
  walk(root, 0)

  const content = `# ${root.title}\n\n## Contents\n\n${tocLines.join('\n')}\n\n---\n\n${sections.join('\n\n---\n\n')}\n`
  downloadMarkdown(`${slugify(root.title)}-notebook.md`, content)
}
