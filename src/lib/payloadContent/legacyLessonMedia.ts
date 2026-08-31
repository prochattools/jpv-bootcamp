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
  return `/legacy-media/${parts.map((part) => encodeURIComponent(part)).join('/')}`
}

type MissingLessonImage = {
  filename: string
  publicUrl: string
  alt: string
  insertAfterFirstImage: boolean
}

const MISSING_LEGACY_LESSON_IMAGES: Record<string, MissingLessonImage> = {
  // These two blocks are present in the WordPress source, but were omitted
  // from the already-imported Payload lesson content.
  'lesson-5-the-legal-agreement': {
    filename: 'legal_agreement.jpg',
    publicUrl: '/legacy-media/2025/12/legal_agreement.jpg',
    alt: 'Legal agreement',
    insertAfterFirstImage: false,
  },
  'lesson-6-the-word-of-god': {
    filename: 'banner1.png',
    publicUrl: '/legacy-media/2025/11/banner1.png',
    alt: 'Property for Christians on Fire',
    insertAfterFirstImage: true,
  },
}

function payloadPreviewStaticMediaUrl(source: string): string | null {
  const decoded = decodeHtmlEntities(source.trim())
  let parsed: URL
  try {
    parsed = new URL(decoded)
  } catch {
    return null
  }

  if (parsed.hostname.toLowerCase() !== 'preview.jpvbootcamp.com' || parsed.search || parsed.hash) return null

  const match = parsed.pathname.match(/^\/api\/payload_media\/file\/([^/]+)$/i)
  if (!match?.[1]) return null

  let filename: string
  try {
    filename = decodeURIComponent(match[1])
  } catch {
    return null
  }

  if (!filename || filename.includes('/') || filename.includes('\\') || filename === '.' || filename === '..') return null
  return `/legacy-media-by-name/${encodeURIComponent(filename)}`
}

function rewritePayloadPreviewImageSources(safeHtml: string): string {
  return safeHtml.replace(
    /(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)(\2)/gi,
    (full, prefix: string, quote: string, source: string) => {
      const replacement = payloadPreviewStaticMediaUrl(source)
      return replacement ? `${prefix}${quote}${escapeAttribute(replacement)}${quote}` : full
    },
  )
}

function missingLessonImageHtml(image: MissingLessonImage): string {
  return `<img src="${escapeAttribute(image.publicUrl)}" alt="${escapeAttribute(image.alt)}" loading="lazy" decoding="async" />`
}

export function restoreLegacyLessonImageSources(
  safeHtml: string,
  lessonSlug: string,
  options: { addMissingLessonImage?: boolean } = {},
): { html: string; addedMissingLessonImage: boolean } {
  let html = rewritePayloadPreviewImageSources(restoreLegacyLessonImagePlaceholders(safeHtml))
  if (options.addMissingLessonImage === false) return { html, addedMissingLessonImage: false }

  let normalizedLessonSlug = lessonSlug
  try {
    normalizedLessonSlug = decodeURIComponent(lessonSlug)
  } catch {
    // The lesson slug is normally already decoded; an invalid escape cannot
    // match one of the known source-backed fallback lessons.
  }
  const image = MISSING_LEGACY_LESSON_IMAGES[normalizedLessonSlug.toLowerCase()]
  const escapedFilename = image?.filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const imageAlreadyRendered = image && escapedFilename
    ? new RegExp(`<img\\b[^>]*\\bsrc=["'][^"']*${escapedFilename}["']`, 'i').test(html)
    : false
  if (!image || imageAlreadyRendered) {
    return { html, addedMissingLessonImage: false }
  }

  const imageHtml = missingLessonImageHtml(image)
  if (image.insertAfterFirstImage) {
    const firstImage = /<img\b[^>]*>/i
    if (firstImage.test(html)) {
      html = html.replace(firstImage, (match) => `${match}${imageHtml}`)
    } else {
      html = `${imageHtml}${html}`
    }
  } else {
    html = `${imageHtml}${html}`
  }

  return { html, addedMissingLessonImage: true }
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
