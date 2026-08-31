import path from 'node:path'

import type { LegacyImageResolution } from './legacyRichText'

type LocalMediaEntry = {
  relativePath: string
  importable: boolean
}

function normalizeRelative(value: string): string | null {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+/, '')
  const parts = normalized.split('/').filter(Boolean)
  if (!parts.length || parts.some((part) => part === '..')) return null
  return parts.join('/')
}

function sourceUploadRelativePath(sourceUrl: string): string | null {
  let pathname = sourceUrl.trim()
  try {
    pathname = new URL(pathname).pathname
  } catch {
    // Relative legacy URLs are handled below.
  }

  const lower = pathname.toLowerCase()
  const markers = ['/wp-content/uploads/', '/uploads/']
  const marker = markers.find((candidate) => lower.includes(candidate))
  if (!marker) return null

  const start = lower.indexOf(marker) + marker.length
  try {
    return normalizeRelative(decodeURIComponent(pathname.slice(start)))
  } catch {
    return normalizeRelative(pathname.slice(start))
  }
}

function publicStaticUrl(relativePath: string): string {
  return `/legacy-media/${relativePath.split('/').map((part) => encodeURIComponent(part)).join('/')}`
}

/**
 * Resolves WordPress inline image URLs to the deterministic static archive
 * path copied into the production image. Exact upload paths win; basename
 * fallback is used only when that basename is unique in the archive.
 */
export function createLegacyStaticImageResolver(
  localMedia: readonly LocalMediaEntry[],
): (sourceUrl: string) => LegacyImageResolution | undefined {
  const byPath = new Map<string, LocalMediaEntry>()
  const basenameBuckets = new Map<string, LocalMediaEntry[]>()

  for (const entry of localMedia) {
    if (!entry.importable) continue
    const relativePath = normalizeRelative(entry.relativePath)
    if (!relativePath) continue
    byPath.set(relativePath.toLowerCase(), { ...entry, relativePath })
    const basename = path.posix.basename(relativePath).toLowerCase()
    const bucket = basenameBuckets.get(basename) ?? []
    bucket.push({ ...entry, relativePath })
    basenameBuckets.set(basename, bucket)
  }

  const uniqueByBasename = new Map<string, LocalMediaEntry>()
  for (const [basename, entries] of basenameBuckets) {
    if (entries.length === 1) uniqueByBasename.set(basename, entries[0]!)
  }

  return (sourceUrl) => {
    const relativePath = sourceUploadRelativePath(sourceUrl)
    const exact = relativePath ? byPath.get(relativePath.toLowerCase()) : undefined
    const basename = relativePath ? path.posix.basename(relativePath).toLowerCase() : null
    const entry = exact ?? (basename ? uniqueByBasename.get(basename) : undefined)
    if (!entry) return undefined
    return { publicUrl: publicStaticUrl(entry.relativePath), alt: path.posix.basename(entry.relativePath) }
  }
}
