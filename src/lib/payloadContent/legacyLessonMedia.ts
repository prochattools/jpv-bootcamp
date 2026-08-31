function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function staticLegacyMediaUrl(source: string): string | null {
  let pathname = decodeHtmlEntities(source.trim())
  try {
    pathname = new URL(pathname).pathname
  } catch {
    // Relative legacy URLs are handled below.
  }

  const lower = pathname.toLowerCase()
  const marker = lower.includes('/wp-content/uploads/')
    ? '/wp-content/uploads/'
    : lower.includes('/uploads/')
      ? '/uploads/'
      : null
  if (!marker) return null

  const start = lower.indexOf(marker) + marker.length
  let relative: string
  try {
    relative = decodeURIComponent(pathname.slice(start))
  } catch {
    relative = pathname.slice(start)
  }
  const parts = relative.replace(/\\/g, '/').split('/').filter(Boolean)
  if (!parts.length || parts.some((part) => part === '..' || part === '.')) return null
  return `/media/legacy/${parts.map((part) => encodeURIComponent(part)).join('/')}`
}

/**
 * Repairs already-imported legacyHTML blocks whose sanitizer preserved an
 * inline WordPress image as text because the old import had no media map.
 * Only the sanitized placeholder text is read; raw legacy HTML is never
 * rendered. The image is restored only to the bundled local archive path.
 */
export function restoreLegacyLessonImagePlaceholders(safeHtml: string): string {
  return safeHtml.replace(
    /<span\b([^>]*data-legacy-image-preserved(?:\s*=\s*["'][^"']*["'])?[^>]*)>([\s\S]*?)<\/span>/gi,
    (full, _attributes: string, inner: string) => {
      const text = decodeHtmlEntities(inner).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
      const sourceMatch = text.match(/((?:https?:\/\/[^\s()<>"']+)?\/(?:wp-content\/uploads|uploads)\/[^\s()<>"']+)/i)
      if (!sourceMatch?.[1]) return full
      const src = staticLegacyMediaUrl(sourceMatch[1])
      if (!src) return full
      const alt = text.slice(0, text.indexOf(sourceMatch[1])).replace(/\s*\($/, '').trim() || 'Lesson image'
      return `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt.slice(0, 250))}" loading="lazy" decoding="async" />`
    },
  )
}
