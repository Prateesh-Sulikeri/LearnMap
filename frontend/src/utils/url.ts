import { API_ORIGIN } from '@/services/client'

// Uploaded images (notes, avatars) are returned as root-relative paths (see
// uploadsApi/backend upload handler) so a change of domain never breaks
// already-saved data — resolve them against the backend's origin here, at
// render time. Externally hosted http(s) URLs pass through unchanged.
export function resolveAssetUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return url.startsWith('/') ? `${API_ORIGIN}${url}` : url
}
