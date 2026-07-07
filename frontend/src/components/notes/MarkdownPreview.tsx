import { isValidElement, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { Check, Copy } from 'lucide-react'
import { resolveAssetUrl } from '@/utils/url'
import { cn } from '@/lib/utils'
import './markdown-preview.css'

const remarkPlugins = [remarkGfm]
const rehypePlugins = [rehypeHighlight]

// "size=small|medium|large" set via the toolbar's image-size buttons, using
// the standard markdown title-attribute slot rather than raw HTML — kept
// out of the actual rendered `title` attribute so the browser doesn't show
// it as a literal "size=medium" hover tooltip.
const SIZE_CLASSES: Record<string, string> = {
  small: 'md-img-small',
  medium: 'md-img-medium',
  large: 'md-img-large',
}

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
        {copied ? (
          <>
            <Check className="size-3.5" />
            Copied!
          </>
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
      {children}
    </pre>
  )
}

const components: Components = {
  img: ({ src, alt, title }) => {
    const sizeMatch = title?.match(/^size=(small|medium|large)$/)
    return (
      <img
        src={resolveAssetUrl(typeof src === 'string' ? src : undefined)}
        alt={alt ?? ''}
        title={sizeMatch ? undefined : title}
        className={cn(sizeMatch && SIZE_CLASSES[sizeMatch[1]])}
      />
    )
  },
  pre: CodeBlock,
}

export function MarkdownPreview({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
  }
  return (
    <div className="md-preview">
      <ReactMarkdown components={components} remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
        {source}
      </ReactMarkdown>
    </div>
  )
}
