import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { API_ORIGIN } from '@/services/client'
import './markdown-preview.css'

// Uploaded images are returned as root-relative paths (see uploadsApi/backend
// upload handler) so a change of domain never breaks already-saved notes —
// resolve them against the backend's origin here, at render time. Externally
// pasted http(s) URLs pass through unchanged.
function resolveImageSrc(src: string | undefined): string | undefined {
  if (!src) return src
  return src.startsWith('/') ? `${API_ORIGIN}${src}` : src
}

const components: Components = {
  img: ({ src, alt }) => <img src={resolveImageSrc(typeof src === 'string' ? src : undefined)} alt={alt ?? ''} />,
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
