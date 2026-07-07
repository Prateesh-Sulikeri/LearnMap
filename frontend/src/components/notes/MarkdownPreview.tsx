import { isValidElement, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { Check, Copy } from 'lucide-react'
import { resolveAssetUrl } from '@/utils/url'
import './markdown-preview.css'

function extractText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractText).join('')
  if (isValidElement<{ children?: React.ReactNode }>(node)) return extractText(node.props.children)
  return ''
}

function CodeBlock({ children }: { children?: React.ReactNode }) {
  const [copied, setCopied] = useState(false)

  const codeElement = Array.isArray(children) ? children[0] : children
  const className = isValidElement<{ className?: string }>(codeElement) ? codeElement.props.className : undefined
  const language = className?.match(/language-(\w+)/)?.[1]

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(extractText(children))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can fail (permissions, non-secure context) — not worth surfacing an error toast for.
    }
  }

  return (
    <pre>
      {language && <span className="md-preview-lang">{language}</span>}
      <button type="button" className="md-preview-copy" onClick={() => void handleCopy()} aria-label="Copy code">
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      </button>
      {children}
    </pre>
  )
}

const components: Components = {
  img: ({ src, alt }) => <img src={resolveAssetUrl(typeof src === 'string' ? src : undefined)} alt={alt ?? ''} />,
  pre: CodeBlock,
}

export function MarkdownPreview({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
  }
  return (
    <div className="md-preview">
      <ReactMarkdown components={components}>{source}</ReactMarkdown>
    </div>
  )
}
