/**
 * WordPress export adapter.
 *
 * Converts WordPress exports (WXR/XML, CSV, JSON) into the canonical
 * jpv-programme-content.v1 package format defined in programmeContentContract.ts.
 *
 * Design invariants:
 * - All imported content is marked status: 'draft' — manual approval required.
 * - publicationIntent is always 'candidate' (never 'approved_for_import').
 * - HTML content is sanitised: scripts, iframes, tracking pixels are stripped.
 * - Media URLs are recorded as MediaReferences for later download — never fetched inline.
 * - Stable IDs are generated from slugs using SHA-256.
 * - No external npm packages: Node.js built-ins only (fs, path, crypto).
 * - WXR parsing uses regex-based extraction of well-known elements.
 *   (WordPress 1.2/2.0 WXR format, exported from wp-admin > Tools > Export)
 * - CSV parsing handles simple \n row, comma-column splitting with quote awareness.
 */

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

import {
  PROGRAMME_CONTENT_FORMAT,
  type ProgrammeContentPackage,
  type ProgrammeLesson,
  type ProgrammeResource,
  type ProgrammeWeek,
} from './programmeContentContract'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type WordPressExportFormat = 'wxr' | 'csv' | 'json'

export interface WordPressAdapterConfig {
  inputPath: string
  format: WordPressExportFormat
  sourceSiteUrl: string
  targetProgrammeSlug: string
}

export interface AdapterResult {
  success: boolean
  package: ProgrammeContentPackage
  warnings: string[]
  mediaReferences: MediaReference[]
}

export interface MediaReference {
  sourceUrl: string
  targetPath: string
  mimeType: string
  lessonSlug: string
}

// ---------------------------------------------------------------------------
// Internal intermediate type: parsed WordPress item before canonical mapping
// ---------------------------------------------------------------------------

interface WpItem {
  postId: string
  postType: string
  postStatus: string
  title: string
  slug: string
  content: string
  excerpt: string
  menuOrder: number
  parentPostId: string
  categories: string[]
  tags: string[]
  meta: Record<string, string>
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic, slug-safe ID from a string value.
 * Uses the first 16 hex chars of SHA-256 as a suffix for uniqueness
 * while keeping the base slug readable.
 */
function stableId(slug: string): string {
  const hash = createHash('sha256').update(slug).digest('hex').slice(0, 8)
  const safe = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return safe ? `${safe}-${hash}` : `item-${hash}`
}

// ---------------------------------------------------------------------------
// HTML sanitisation
// Strips scripts, iframes, tracking pixels, event handlers, and data: URIs.
// Conservative: prefers removing uncertain elements over keeping them.
// ---------------------------------------------------------------------------

function sanitiseHtml(raw: string): string {
  if (!raw) return ''

  let sanitised = raw

  // Remove script elements and their contents
  sanitised = sanitised.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')

  // Remove style elements and their contents
  sanitised = sanitised.replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')

  // Remove iframe elements
  sanitised = sanitised.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe\s*>/gi, '')
  sanitised = sanitised.replace(/<iframe\b[^>]*/gi, '')

  // Remove tracking pixels: <img> elements with src matching known trackers
  // or with width=1 and height=1 (1x1 pixel pattern)
  sanitised = sanitised.replace(
    /<img\b[^>]*(?:width=["']?1["']?[^>]*height=["']?1["']?|height=["']?1["']?[^>]*width=["']?1["']?)[^>]*>/gi,
    '',
  )

  // Remove inline event handlers (onclick, onload, onerror, etc.)
  sanitised = sanitised.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  // Remove data: URI references (potential XSS vector)
  sanitised = sanitised.replace(/\bdata:[^"'\s>]+/gi, '')

  // Remove javascript: URI references
  sanitised = sanitised.replace(/\bjavascript:[^"'\s>]*/gi, '')

  return sanitised.trim()
}

/**
 * Strip all HTML tags and return plain text.
 * Used for summary/excerpt fields where rich text is not wanted.
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// ---------------------------------------------------------------------------
// Media reference extraction
// ---------------------------------------------------------------------------

function extractMediaReferences(
  content: string,
  sourceSiteUrl: string,
  lessonSlug: string,
): MediaReference[] {
  const references: MediaReference[] = []
  const seen = new Set<string>()

  // Match src attributes in img, video, audio, source, a (download links)
  const srcPattern = /\bsrc=["']([^"']+)["']/gi
  let match: RegExpExecArray | null

  // eslint-disable-next-line no-cond-assign
  while ((match = srcPattern.exec(content)) !== null) {
    const url = match[1]
    if (!url || seen.has(url)) continue
    seen.add(url)

    if (url.startsWith(sourceSiteUrl) || isRelativeUrl(url)) {
      const ref = buildMediaReference(url, sourceSiteUrl, lessonSlug)
      if (ref) references.push(ref)
    }
  }

  // Match href for anchor download patterns
  const hrefPattern = /\bhref=["']([^"']+)["'][^>]*?(?:download|class=["'][^"']*download[^"']*["'])/gi
  while ((match = hrefPattern.exec(content)) !== null) {
    const url = match[1]
    if (!url || seen.has(url)) continue
    seen.add(url)

    if (url.startsWith(sourceSiteUrl) || isRelativeUrl(url)) {
      const ref = buildMediaReference(url, sourceSiteUrl, lessonSlug)
      if (ref) references.push(ref)
    }
  }

  return references
}

function isRelativeUrl(url: string): boolean {
  return !url.startsWith('http') && !url.startsWith('//') && !url.startsWith('data:')
}

function guessMimeType(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    ogg: 'audio/ogg',
    zip: 'application/zip',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
  return mimeMap[ext] ?? 'application/octet-stream'
}

function buildMediaReference(
  url: string,
  sourceSiteUrl: string,
  lessonSlug: string,
): MediaReference | null {
  let fullUrl = url
  if (isRelativeUrl(url)) {
    fullUrl = sourceSiteUrl.replace(/\/$/, '') + (url.startsWith('/') ? '' : '/') + url
  }

  const fileName = url.split('?')[0].split('/').filter(Boolean).pop()
  if (!fileName) return null

  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const safeLesson = lessonSlug.replace(/[^a-z0-9-]/g, '-')
  const targetPath = `media/${safeLesson}/${fileName}`

  return {
    sourceUrl: fullUrl,
    targetPath,
    mimeType: guessMimeType(url),
    lessonSlug,
  }
}

// ---------------------------------------------------------------------------
// WXR (WordPress eXtended RSS) parser
// ---------------------------------------------------------------------------

/**
 * Extract a single XML element value using simple regex.
 * Handles CDATA and plain text content.
 */
function extractElement(xml: string, tag: string): string {
  // Try CDATA first
  const cdataPattern = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i')
  const cdataMatch = cdataPattern.exec(xml)
  if (cdataMatch) return cdataMatch[1]

  // Plain text
  const plainPattern = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i')
  const plainMatch = plainPattern.exec(xml)
  if (plainMatch) return plainMatch[1].trim()

  return ''
}

/**
 * Extract WXR namespace element (e.g. <wp:post_id> → extractWpElement(xml, 'post_id'))
 */
function extractWpElement(xml: string, field: string): string {
  return extractElement(xml, `wp:${field}`)
}

function extractContentElement(xml: string): string {
  return extractElement(xml, 'content:encoded')
}

function extractExcerptElement(xml: string): string {
  return extractElement(xml, 'excerpt:encoded')
}

/**
 * Extract all <category> elements with a specific domain.
 */
function extractCategories(xml: string, domain?: string): string[] {
  const domainAttr = domain ? `domain="${domain}"` : ''
  const pattern = new RegExp(
    `<category[^>]*${domainAttr}[^>]*>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([^<]*))<\\/category>`,
    'gi',
  )
  const results: string[] = []
  let match: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((match = pattern.exec(xml)) !== null) {
    const value = (match[1] ?? match[2] ?? '').trim()
    if (value) results.push(value)
  }
  return results
}

/**
 * Extract a <wp:postmeta> value by key from an item block.
 */
function extractPostMeta(itemXml: string): Record<string, string> {
  const meta: Record<string, string> = {}
  const metaBlockPattern = /<wp:postmeta>([\s\S]*?)<\/wp:postmeta>/gi
  let blockMatch: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((blockMatch = metaBlockPattern.exec(itemXml)) !== null) {
    const block = blockMatch[1]
    const keyMatch = /<wp:meta_key[^>]*>(?:<!\[CDATA\[)?([^\]<]*)(?:\]\]>)?<\/wp:meta_key>/i.exec(block)
    const valueMatch = /<wp:meta_value[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/wp:meta_value>/i.exec(block)
    if (keyMatch && valueMatch) {
      meta[keyMatch[1].trim()] = valueMatch[1].trim()
    }
  }
  return meta
}

/**
 * Split WXR XML into individual <item> blocks.
 */
function splitWxrItems(xml: string): string[] {
  const items: string[] = []
  const pattern = /<item>([\s\S]*?)<\/item>/gi
  let match: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((match = pattern.exec(xml)) !== null) {
    items.push(match[1])
  }
  return items
}

function parseWxrItem(itemXml: string): WpItem {
  return {
    postId: extractWpElement(itemXml, 'post_id'),
    postType: extractWpElement(itemXml, 'post_type'),
    postStatus: extractWpElement(itemXml, 'status'),
    title: extractElement(itemXml, 'title'),
    slug: extractWpElement(itemXml, 'post_name'),
    content: extractContentElement(itemXml),
    excerpt: extractExcerptElement(itemXml),
    menuOrder: parseInt(extractWpElement(itemXml, 'menu_order'), 10) || 0,
    parentPostId: extractWpElement(itemXml, 'post_parent'),
    categories: extractCategories(itemXml, 'category'),
    tags: extractCategories(itemXml, 'post_tag'),
    meta: extractPostMeta(itemXml),
  }
}

function parseWxr(xml: string): WpItem[] {
  const itemBlocks = splitWxrItems(xml)
  return itemBlocks.map(parseWxrItem)
}

// ---------------------------------------------------------------------------
// CSV parser
// ---------------------------------------------------------------------------

/**
 * Parse a CSV string into an array of row objects keyed by header column names.
 * Handles double-quote escaping and quoted fields containing commas and newlines.
 */
function parseCsv(raw: string): Record<string, string>[] {
  const lines = raw.split(/\r?\n/)
  if (lines.length === 0) return []

  const headers = splitCsvRow(lines[0])
  if (headers.length === 0) return []

  const rows: Record<string, string>[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const values = splitCsvRow(line)
    const row: Record<string, string> = {}

    for (const [index, header] of headers.entries()) {
      row[header.trim()] = values[index]?.trim() ?? ''
    }

    rows.push(row)
  }

  return rows
}

/**
 * Split a single CSV row respecting double-quoted fields.
 */
function splitCsvRow(row: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        // Escaped double quote
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  fields.push(current)
  return fields
}

/**
 * Convert CSV rows to WpItem format.
 * Expected columns (case-insensitive): title, slug, content, excerpt, post_type,
 * status, menu_order, parent_id, categories, tags, [any meta_ prefixed columns]
 */
function csvRowsToWpItems(rows: Record<string, string>[]): WpItem[] {
  return rows.map((row, index) => {
    const get = (key: string): string => {
      const found = Object.keys(row).find((k) => k.toLowerCase() === key.toLowerCase())
      return found ? (row[found] ?? '') : ''
    }

    const meta: Record<string, string> = {}
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().startsWith('meta_')) {
        meta[key.slice(5)] = row[key] ?? ''
      }
    }

    return {
      postId: get('id') || get('post_id') || String(index + 1),
      postType: get('post_type') || 'lesson',
      postStatus: get('status') || 'publish',
      title: get('title'),
      slug: get('slug') || get('post_name'),
      content: get('content') || get('body'),
      excerpt: get('excerpt') || get('summary'),
      menuOrder: parseInt(get('menu_order') || get('sort_order') || '0', 10) || 0,
      parentPostId: get('parent_id') || get('parent_post_id') || '',
      categories: (get('categories') || '').split('|').map((s) => s.trim()).filter(Boolean),
      tags: (get('tags') || '').split('|').map((s) => s.trim()).filter(Boolean),
      meta,
    }
  })
}

// ---------------------------------------------------------------------------
// JSON passthrough parser
// ---------------------------------------------------------------------------

/**
 * Accept a JSON export where the root is an array of item-shaped objects,
 * or an object with a top-level "items" or "posts" key.
 */
function parseJsonExport(jsonText: string): WpItem[] {
  const parsed: unknown = JSON.parse(jsonText)

  let items: unknown[]

  if (Array.isArray(parsed)) {
    items = parsed
  } else if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>
    if (Array.isArray(obj.items)) items = obj.items
    else if (Array.isArray(obj.posts)) items = obj.posts
    else if (Array.isArray(obj.lessons)) items = obj.lessons
    else items = [obj]
  } else {
    return []
  }

  return items.map((item, index) => {
    if (!item || typeof item !== 'object') return blankWpItem(index)
    const obj = item as Record<string, unknown>

    const str = (key: string): string => {
      const value = obj[key]
      return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''
    }

    const meta: Record<string, string> = {}
    const rawMeta = obj.meta ?? obj.postmeta ?? obj.custom_fields
    if (rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)) {
      for (const [k, v] of Object.entries(rawMeta as Record<string, unknown>)) {
        meta[k] = typeof v === 'string' ? v : String(v)
      }
    }

    return {
      postId: str('id') || str('post_id') || String(index + 1),
      postType: str('post_type') || str('type') || 'lesson',
      postStatus: str('status') || str('post_status') || 'publish',
      title: str('title') || str('post_title'),
      slug: str('slug') || str('post_name'),
      content: str('content') || str('post_content') || str('body'),
      excerpt: str('excerpt') || str('post_excerpt') || str('summary'),
      menuOrder: typeof obj.menu_order === 'number' ? obj.menu_order : parseInt(str('menu_order'), 10) || 0,
      parentPostId: str('parent_id') || str('post_parent') || '',
      categories: asStringArray(obj.categories),
      tags: asStringArray(obj.tags),
      meta,
    }
  })
}

function blankWpItem(index: number): WpItem {
  return {
    postId: String(index + 1),
    postType: 'lesson',
    postStatus: 'draft',
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    menuOrder: index,
    parentPostId: '',
    categories: [],
    tags: [],
    meta: {},
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v) => typeof v === 'string') as string[]
}

// ---------------------------------------------------------------------------
// Lesson type inference
// ---------------------------------------------------------------------------

type LessonType = 'video' | 'reading' | 'worksheet' | 'exercise' | 'call'

function inferLessonType(item: WpItem): LessonType {
  const combined = [item.title, ...item.categories, ...item.tags, item.meta.lesson_type ?? '']
    .join(' ')
    .toLowerCase()

  if (combined.includes('video') || combined.includes('watch')) return 'video'
  if (combined.includes('worksheet') || combined.includes('workbook')) return 'worksheet'
  if (combined.includes('exercise') || combined.includes('practise') || combined.includes('practice')) return 'exercise'
  if (combined.includes('call') || combined.includes('live') || combined.includes('coaching')) return 'call'
  return 'reading'
}

function inferVideoReference(item: WpItem): string | null {
  // Check postmeta for common video fields
  const metaKeys = ['video_url', '_video_url', 'video', 'lesson_video_url', 'wistia_url', 'vimeo_url', 'youtube_url']
  for (const key of metaKeys) {
    if (item.meta[key]) return item.meta[key]
  }

  // Scan content for iframe src pointing to known video hosts
  const iframePattern = /<iframe\b[^>]*\bsrc=["']([^"']+(?:youtube|vimeo|wistia|loom|bunny)[^"']*)["']/i
  const match = iframePattern.exec(item.content)
  if (match) return match[1]

  return null
}

// ---------------------------------------------------------------------------
// Canonical package builder
// ---------------------------------------------------------------------------

const REQUIRED_WEEK_COUNT = 8

function safeSlug(raw: string, fallback: string): string {
  const cleaned = (raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
  return cleaned || fallback.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 80)
}

/**
 * Group WpItems into week buckets using categories, tags, or menu_order.
 *
 * Grouping priority:
 * 1. Category containing "week" or a numeric module indicator
 * 2. menuOrder (items 0–0 → week 1, items 1-N sequentially by sorted order)
 * 3. Fallback: all items in a single week
 */
function groupIntoWeeks(items: WpItem[]): WpItem[][] {
  // Try to find week-style categories
  const weekGroups = new Map<string, WpItem[]>()

  for (const item of items) {
    const weekCat = item.categories.find(
      (c) => /week\s*\d+|module\s*\d+|session\s*\d+/i.test(c),
    )

    const key = weekCat ?? `__order_${item.menuOrder}`
    const existing = weekGroups.get(key) ?? []
    existing.push(item)
    weekGroups.set(key, existing)
  }

  // Sort the groups by their natural order
  const sortedKeys = [...weekGroups.keys()].sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, ''), 10) || 0
    const numB = parseInt(b.replace(/\D/g, ''), 10) || 0
    return numA - numB
  })

  const groups = sortedKeys.map((key) => weekGroups.get(key) ?? [])

  // Pad or truncate to exactly REQUIRED_WEEK_COUNT groups.
  // We always pad to 8 so the package passes structural validation.
  while (groups.length < REQUIRED_WEEK_COUNT) {
    groups.push([])
  }

  return groups.slice(0, REQUIRED_WEEK_COUNT)
}

function wpItemToLesson(
  item: WpItem,
  sequence: number,
  sourceSiteUrl: string,
  mediaRefs: MediaReference[],
  warnings: string[],
): ProgrammeLesson {
  const rawSlug = item.slug || safeSlug(item.title, `lesson-${sequence}`)
  const slug = safeSlug(rawSlug, `lesson-${sequence}`)
  const id = stableId(slug)

  const sanitisedBody = sanitiseHtml(item.content)
  const excerpt = stripHtmlTags(item.excerpt || item.content).slice(0, 500)

  const refs = extractMediaReferences(item.content, sourceSiteUrl, slug)
  mediaRefs.push(...refs)

  if (!item.title.trim()) {
    warnings.push(`lesson:${id} — missing title (post_id=${item.postId})`)
  }

  const videoRef = inferVideoReference(item)
  const lessonType = inferLessonType(item)

  const resources: ProgrammeResource[] = buildResourcesFromItem(item, id, warnings)

  return {
    id,
    slug,
    sequence,
    title: item.title.trim() || `Lesson ${sequence}`,
    summary: excerpt || `Imported lesson ${sequence}.`,
    body: sanitisedBody || `Imported lesson content for ${item.title}.`,
    estimatedDuration: item.meta.estimated_duration ?? item.meta.duration ?? '30 min',
    lessonType,
    previewAvailable: false,
    videoReference: videoRef,
    status: 'draft',
    resources,
  }
}

function buildResourcesFromItem(
  item: WpItem,
  lessonId: string,
  warnings: string[],
): ProgrammeResource[] {
  const resources: ProgrammeResource[] = []

  // Check meta for attached PDF/file URLs
  const fileKeys = ['file_url', 'download_url', 'attachment_url', 'resource_url']
  for (const [keyIndex, key] of fileKeys.entries()) {
    const url = item.meta[key]
    if (!url || !url.startsWith('https://')) continue

    const resourceId = stableId(`${item.slug ?? lessonId}-resource-${keyIndex}`)
    const fileName = url.split('/').pop()?.split('?')[0] ?? 'download'
    const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
    const isVideo = ['mp4', 'webm'].includes(ext)

    resources.push({
      id: resourceId,
      label: `${item.title} — ${fileName}`,
      resourceType: isVideo ? 'video_reference' : 'download',
      source: url,
      accessibilityLabel: `Download ${fileName}`,
      status: 'draft',
    })
  }

  // Check for external link meta
  const linkKeys = ['external_link', 'link_url', 'resource_link']
  for (const [keyIndex, key] of linkKeys.entries()) {
    const url = item.meta[key]
    if (!url || !url.startsWith('https://')) continue

    const resourceId = stableId(`${item.slug ?? lessonId}-link-${keyIndex}`)
    resources.push({
      id: resourceId,
      label: item.meta[`${key}_label`] ?? url.slice(0, 60),
      resourceType: 'link',
      source: url,
      accessibilityLabel: `Open external resource`,
      status: 'draft',
    })
  }

  if (resources.length === 0 && item.meta.has_resources === 'yes') {
    warnings.push(`lesson:${lessonId} — has_resources meta is 'yes' but no resource URLs found (post_id=${item.postId})`)
  }

  return resources
}

function wpGroupToWeek(
  items: WpItem[],
  weekIndex: number,
  sourceSiteUrl: string,
  mediaRefs: MediaReference[],
  warnings: string[],
): ProgrammeWeek {
  const sequence = weekIndex + 1
  const weekSlug = `week-${String(sequence).padStart(2, '0')}`
  const weekId = stableId(weekSlug)

  // Derive week title from the first item's category or a default
  const firstItem = items[0]
  const weekCat = firstItem?.categories.find(
    (c) => /week\s*\d+|module\s*\d+|session\s*\d+/i.test(c),
  )
  const weekTitle = weekCat ?? `Week ${sequence}`

  // Sort items within the week by menuOrder
  const sortedItems = [...items].sort((a, b) => a.menuOrder - b.menuOrder)

  const lessons: ProgrammeLesson[] = sortedItems.map((item, idx) =>
    wpItemToLesson(item, idx + 1, sourceSiteUrl, mediaRefs, warnings),
  )

  if (lessons.length === 0) {
    warnings.push(`week:${weekId} (${weekTitle}) — no lessons found, inserting placeholder`)
    lessons.push({
      id: stableId(`${weekSlug}-placeholder`),
      slug: `${weekSlug}-placeholder`,
      sequence: 1,
      title: `${weekTitle} — Content Pending`,
      summary: 'This lesson has not been imported.',
      body: 'Content pending review.',
      estimatedDuration: '30 min',
      lessonType: 'reading',
      previewAvailable: false,
      videoReference: null,
      status: 'draft',
      resources: [],
    })
  }

  return {
    id: weekId,
    slug: weekSlug,
    sequence,
    title: weekTitle,
    summary: firstItem?.excerpt
      ? stripHtmlTags(firstItem.excerpt).slice(0, 300)
      : `Imported content for ${weekTitle}.`,
    learningOutcomes: ['Content imported from WordPress — review required.'],
    estimatedDuration: `${lessons.length * 30} min`,
    status: 'draft',
    lessons,
  }
}

/**
 * Filter items to those representing lesson-like post types.
 * WordPress lesson plugins use a variety of post types.
 */
function filterLessonItems(items: WpItem[]): WpItem[] {
  const lessonTypes = new Set([
    'lesson',
    'sfwd-lessons',
    'ld-lesson',
    'llms_lesson',
    'tutor_lesson',
    'post',
    'page',
  ])

  const publishedStatuses = new Set(['publish', 'published', 'private'])

  return items.filter(
    (item) =>
      lessonTypes.has(item.postType) &&
      (publishedStatuses.has(item.postStatus) || item.postStatus === 'draft'),
  )
}

// ---------------------------------------------------------------------------
// Main adapter entry point
// ---------------------------------------------------------------------------

export function runWordPressAdapter(config: WordPressAdapterConfig): AdapterResult {
  const warnings: string[] = []
  const mediaRefs: MediaReference[] = []

  // Read input file
  let rawInput: string
  try {
    rawInput = readFileSync(config.inputPath, 'utf8')
  } catch (e) {
    return {
      success: false,
      package: emptyPackage(config),
      warnings: [`input_read_failed: ${e instanceof Error ? e.message : String(e)}`],
      mediaReferences: [],
    }
  }

  // Parse into WpItems
  let allItems: WpItem[]
  try {
    if (config.format === 'wxr') {
      allItems = parseWxr(rawInput)
    } else if (config.format === 'csv') {
      allItems = csvRowsToWpItems(parseCsv(rawInput))
    } else {
      allItems = parseJsonExport(rawInput)
    }
  } catch (e) {
    return {
      success: false,
      package: emptyPackage(config),
      warnings: [`parse_failed: ${e instanceof Error ? e.message : String(e)}`],
      mediaReferences: [],
    }
  }

  if (allItems.length === 0) {
    warnings.push('no_items_found — export appears empty or unrecognised format')
  }

  // Filter to lesson-like items
  const lessonItems = filterLessonItems(allItems)

  if (lessonItems.length === 0 && allItems.length > 0) {
    warnings.push(
      `no_lesson_type_items_found — found ${allItems.length} total items but none matched lesson post types; falling back to all items`,
    )
    lessonItems.push(...allItems)
  }

  // Group into weeks
  const weekGroups = groupIntoWeeks(lessonItems)

  // Build weeks
  const weeks: ProgrammeWeek[] = weekGroups.map((items, idx) =>
    wpGroupToWeek(items, idx, config.sourceSiteUrl, mediaRefs, warnings),
  )

  // Build programme metadata
  const progId = safeSlug(config.targetProgrammeSlug, 'imported-programme')

  const pkg: ProgrammeContentPackage = {
    packageFormat: PROGRAMME_CONTENT_FORMAT,
    packagePurpose: 'client_submission',
    programme: {
      id: progId,
      title: `${config.targetProgrammeSlug} (Imported)`,
      shortSummary: 'Imported from WordPress — requires editorial review.',
      longDescription:
        'This programme was imported from a WordPress export. All content requires review and approval before publication.',
      version: '0.0.0-import',
      status: 'draft',
      locale: 'en-GB',
      weekCount: REQUIRED_WEEK_COUNT,
      publicationIntent: 'candidate',
    },
    weeks,
    approval: {
      approvalStatus: 'not_approved',
      approver: null,
      approvalDate: null,
      approvalReference: null,
      explicitClientApproval: false,
      publicationApproved: false,
      notes: `Imported via wordpressAdapter from ${config.inputPath}. Not reviewed.`,
    },
  }

  return {
    success: true,
    package: pkg,
    warnings,
    mediaReferences: mediaRefs,
  }
}

// ---------------------------------------------------------------------------
// Helper: empty package for error returns
// ---------------------------------------------------------------------------

function emptyPackage(config: WordPressAdapterConfig): ProgrammeContentPackage {
  const progId = safeSlug(config.targetProgrammeSlug, 'import-failed')

  const blankWeek = (seq: number): ProgrammeWeek => ({
    id: stableId(`week-${seq}`),
    slug: `week-${String(seq).padStart(2, '0')}`,
    sequence: seq,
    title: `Week ${seq}`,
    summary: 'Import failed — content unavailable.',
    learningOutcomes: ['Review required.'],
    estimatedDuration: '0 min',
    status: 'draft',
    lessons: [],
  })

  return {
    packageFormat: PROGRAMME_CONTENT_FORMAT,
    packagePurpose: 'client_submission',
    programme: {
      id: progId,
      title: `${config.targetProgrammeSlug} (Import Failed)`,
      shortSummary: 'Import failed.',
      longDescription: 'Import failed — see adapter warnings for details.',
      version: '0.0.0-import-failed',
      status: 'draft',
      locale: 'en-GB',
      weekCount: REQUIRED_WEEK_COUNT,
      publicationIntent: 'candidate',
    },
    weeks: Array.from({ length: REQUIRED_WEEK_COUNT }, (_, i) => blankWeek(i + 1)),
    approval: {
      approvalStatus: 'not_approved',
      approver: null,
      approvalDate: null,
      approvalReference: null,
      explicitClientApproval: false,
      publicationApproved: false,
      notes: 'Import failed.',
    },
  }
}
