import { createHash } from 'node:crypto'

import {
  BlocksFeature,
  convertHTMLToLexical,
  editorConfigFactory,
  type SerializedBlockNode,
} from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { SanitizedConfig } from 'payload'
import { JSDOM } from 'jsdom'

import {
  legacyMigrationRichTextBlocks,
  type BunnyVideoBlockFields,
  type LegacyHTMLBlockFields,
} from '../../src/richtext/LegacyMigrationBlocks'

export type LegacyMigrationBlockNode =
  | SerializedBlockNode<LegacyHTMLBlockFields>
  | SerializedBlockNode<BunnyVideoBlockFields>

export interface LegacyImageResolution {
  id?: string | number
  relationTo?: 'payload_media' | 'payload_private_media'
  /**
   * Static public URL used for legacy inline images that are archived in the
   * production image but do not have a Payload media relationship yet.
   */
  publicUrl?: string
  alt?: string
}

export interface LegacyRichTextConversionOptions {
  html: string
  resolveImage?: (sourceUrl: string) => LegacyImageResolution | undefined
  sourceLabel?: string
}

export interface LegacyRichTextConversionResult {
  lexical: SerializedEditorState
  sourceHtml: string
  bunnyGuids: string[]
  resolvedImages: string[]
  fallbackFragments: Array<{
    html: string
    reason: string
    sourceTag?: string
  }>
}

type Segment =
  | { kind: 'html'; html: string }
  | { kind: 'bunny'; guid: string; libraryId: number; sourceUrl: string; title?: string }
  | { kind: 'fallback'; html: string; reason: string; sourceTag?: string }

const SAFE_NATIVE_TAGS = new Set([
  'a',
  'b',
  'blockquote',
  'br',
  'code',
  'del',
  'div',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'span',
  'strike',
  'strong',
  'u',
  'ul',
])

const ALWAYS_FALLBACK_TAGS = new Set([
  'audio',
  'canvas',
  'embed',
  'form',
  'object',
  'script',
  'style',
  'svg',
  'table',
  'video',
])

const BUNNY_URL_PATTERN = /\/(?:embed|play)\/(\d+)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i

const minimalSanitizedConfig = {
  collections: [],
  globals: [],
} as unknown as SanitizedConfig

let editorConfigPromise: ReturnType<typeof editorConfigFactory.fromFeatures> | undefined

function getMigrationEditorConfig() {
  editorConfigPromise ??= editorConfigFactory.fromFeatures({
    config: minimalSanitizedConfig,
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      BlocksFeature({ blocks: legacyMigrationRichTextBlocks }),
    ],
  })
  return editorConfigPromise
}

function stableBlockId(kind: string, value: string, ordinal: number): string {
  return createHash('sha256')
    .update(`${kind}:${ordinal}:${value}`)
    .digest('hex')
    .slice(0, 24)
}

function sanitizeLegacyHTMLForDisplay(html: string): string {
  const dom = new JSDOM(html, {
    runScripts: undefined,
    resources: undefined,
    url: 'https://legacy.invalid/',
  })
  const document = dom.window.document

  for (const element of Array.from(document.querySelectorAll('*'))) {
    const tag = element.tagName.toLowerCase()

    if (tag === 'script' || tag === 'style' || tag === 'form' || tag === 'object' || tag === 'embed') {
      element.remove()
      continue
    }

    if (tag === 'iframe' || tag === 'video' || tag === 'audio') {
      const sourceUrl = element.getAttribute('src') || ''
      const placeholder = document.createElement('div')
      placeholder.setAttribute('data-legacy-embed-preserved', tag)
      placeholder.textContent = sourceUrl ? `Legacy ${tag} preserved: ${sourceUrl}` : `Legacy ${tag} preserved for review`
      element.replaceWith(placeholder)
      continue
    }

    if (tag === 'img') {
      const sourceUrl = element.getAttribute('src') || ''
      const alt = element.getAttribute('alt') || 'Legacy image'
      const isSafeLocalMedia = /^\/media\/(?:legacy\/)?[^/].*/i.test(sourceUrl)
      if (!isSafeLocalMedia) {
        const placeholder = document.createElement('span')
        placeholder.setAttribute('data-legacy-image-preserved', 'true')
        placeholder.textContent = sourceUrl ? `${alt} (${sourceUrl})` : alt
        element.replaceWith(placeholder)
        continue
      }

      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase()
        if (!['src', 'alt', 'width', 'height', 'loading', 'decoding'].includes(name)) {
          element.removeAttribute(attribute.name)
        }
      }
      element.setAttribute('alt', alt.slice(0, 250))
      continue
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (name.startsWith('on') || name === 'style' || name === 'srcset' || name === 'formaction' || name === 'action') {
        element.removeAttribute(attribute.name)
        continue
      }
      if ((name === 'href' || name === 'src') && /^(?:javascript|data):/i.test(value)) {
        element.removeAttribute(attribute.name)
      }
    }
  }

  return document.body.innerHTML
}

function serializeNode(node: Node): string {
  if (node.nodeType === node.TEXT_NODE) return node.textContent ?? ''
  if (node.nodeType === node.COMMENT_NODE) return ''
  if (node instanceof node.ownerDocument!.defaultView!.Element) return node.outerHTML
  return node.textContent ?? ''
}

function bunnyFromElement(element: Element): Segment | undefined {
  const sourceUrl = element.getAttribute('src') || element.getAttribute('href') || ''
  if (!sourceUrl) return undefined
  const match = sourceUrl.match(BUNNY_URL_PATTERN)
  if (!match) return undefined
  return {
    kind: 'bunny',
    libraryId: Number(match[1]),
    guid: match[2].toLowerCase(),
    sourceUrl,
    title: element.getAttribute('title') || undefined,
  }
}

function containsSpecialDescendant(element: Element): boolean {
  for (const descendant of Array.from(element.querySelectorAll('*'))) {
    const tag = descendant.tagName.toLowerCase()
    if (bunnyFromElement(descendant)) return true
    if (tag === 'img' || tag === 'iframe' || ALWAYS_FALLBACK_TAGS.has(tag) || !SAFE_NATIVE_TAGS.has(tag)) return true
  }
  return false
}

function segmentNode(
  node: Node,
  resolveImage: LegacyRichTextConversionOptions['resolveImage'],
  resolvedImages: string[],
): Segment[] {
  if (node.nodeType === node.COMMENT_NODE) return []

  if (node.nodeType === node.TEXT_NODE) {
    const text = node.textContent ?? ''
    return text ? [{ kind: 'html', html: text }] : []
  }

  if (!(node instanceof node.ownerDocument!.defaultView!.Element)) {
    const serialized = serializeNode(node)
    return serialized
      ? [{ kind: 'fallback', html: serialized, reason: 'unsupported_dom_node' }]
      : []
  }

  const element = node
  const tag = element.tagName.toLowerCase()
  const bunny = bunnyFromElement(element)
  if (bunny) return [bunny]

  if (tag === 'img') {
    const sourceUrl = element.getAttribute('src') || ''
    if (!sourceUrl) {
      return [{ kind: 'fallback', html: element.outerHTML, reason: 'image_missing_src', sourceTag: tag }]
    }
    const resolved = resolveImage?.(sourceUrl)
    if (!resolved) {
      return [{ kind: 'fallback', html: element.outerHTML, reason: 'image_media_resolution_required', sourceTag: tag }]
    }
    const clone = element.cloneNode(true) as Element
    if (resolved.publicUrl) {
      clone.setAttribute('src', resolved.publicUrl)
      clone.removeAttribute('srcset')
      if (resolved.alt && !clone.getAttribute('alt')) clone.setAttribute('alt', resolved.alt)
      resolvedImages.push(sourceUrl)
      return [{ kind: 'fallback', html: clone.outerHTML, reason: 'image_static_media', sourceTag: tag }]
    }
    if (resolved.id === undefined || !resolved.relationTo) {
      return [{ kind: 'fallback', html: element.outerHTML, reason: 'image_media_resolution_invalid', sourceTag: tag }]
    }
    clone.setAttribute('data-lexical-upload-id', String(resolved.id))
    clone.setAttribute('data-lexical-upload-relation-to', resolved.relationTo)
    if (resolved.alt && !clone.getAttribute('alt')) clone.setAttribute('alt', resolved.alt)
    resolvedImages.push(sourceUrl)
    return [{ kind: 'html', html: clone.outerHTML }]
  }

  if (tag === 'iframe') {
    return [{ kind: 'fallback', html: element.outerHTML, reason: 'unsupported_iframe', sourceTag: tag }]
  }

  if (ALWAYS_FALLBACK_TAGS.has(tag) || !SAFE_NATIVE_TAGS.has(tag)) {
    return [{ kind: 'fallback', html: element.outerHTML, reason: `unsupported_html_tag:${tag}`, sourceTag: tag }]
  }

  if (containsSpecialDescendant(element)) {
    return Array.from(element.childNodes).flatMap((child) => segmentNode(child, resolveImage, resolvedImages))
  }

  return [{ kind: 'html', html: element.outerHTML }]
}

function mergeAdjacentHtmlSegments(segments: Segment[]): Segment[] {
  const merged: Segment[] = []
  for (const segment of segments) {
    const previous = merged.at(-1)
    if (segment.kind === 'html' && previous?.kind === 'html') {
      previous.html += segment.html
    } else {
      merged.push(segment)
    }
  }
  return merged
}

function makeLegacyHTMLBlock(segment: Extract<Segment, { kind: 'fallback' }>, ordinal: number): LegacyMigrationBlockNode {
  return {
    type: 'block',
    version: 2,
    format: '',
    fields: {
      id: stableBlockId('legacyHTML', segment.html, ordinal),
      blockName: null,
      blockType: 'legacyHTML',
      html: segment.html,
      safeHtml: sanitizeLegacyHTMLForDisplay(segment.html),
      reason: segment.reason,
      sourceTag: segment.sourceTag ?? null,
    },
  }
}

function makeBunnyVideoBlock(segment: Extract<Segment, { kind: 'bunny' }>, ordinal: number): LegacyMigrationBlockNode {
  return {
    type: 'block',
    version: 2,
    format: '',
    fields: {
      id: stableBlockId('bunnyVideo', `${segment.libraryId}:${segment.guid}`, ordinal),
      blockName: null,
      blockType: 'bunnyVideo',
      videoGuid: segment.guid,
      libraryId: segment.libraryId,
      title: segment.title ?? null,
      sourceUrl: segment.sourceUrl,
    },
  }
}

export async function convertLegacyHTMLToLexical(
  options: LegacyRichTextConversionOptions,
): Promise<LegacyRichTextConversionResult> {
  const sourceHtml = options.html ?? ''
  const dom = new JSDOM(sourceHtml, {
    runScripts: undefined,
    resources: undefined,
    url: 'https://legacy.invalid/',
  })
  const resolvedImages: string[] = []
  const rawSegments = Array.from(dom.window.document.body.childNodes).flatMap((node) =>
    segmentNode(node, options.resolveImage, resolvedImages),
  )
  const segments = mergeAdjacentHtmlSegments(rawSegments)
  const editorConfig = await getMigrationEditorConfig()

  const rootChildren: unknown[] = []
  const bunnyGuids: string[] = []
  const fallbackFragments: LegacyRichTextConversionResult['fallbackFragments'] = []

  for (const [ordinal, segment] of segments.entries()) {
    if (segment.kind === 'html') {
      if (!segment.html.trim()) continue
      const converted = convertHTMLToLexical({
        editorConfig,
        html: segment.html,
        JSDOM,
      }) as SerializedEditorState
      rootChildren.push(...(converted.root?.children ?? []))
      continue
    }

    if (segment.kind === 'bunny') {
      bunnyGuids.push(segment.guid)
      rootChildren.push(makeBunnyVideoBlock(segment, ordinal))
      continue
    }

    fallbackFragments.push({
      html: segment.html,
      reason: segment.reason,
      ...(segment.sourceTag ? { sourceTag: segment.sourceTag } : {}),
    })
    rootChildren.push(makeLegacyHTMLBlock(segment, ordinal))
  }

  return {
    lexical: {
      root: {
        type: 'root',
        direction: 'ltr',
        format: '',
        indent: 0,
        version: 1,
        children: rootChildren,
      },
    } as SerializedEditorState,
    sourceHtml,
    bunnyGuids,
    resolvedImages,
    fallbackFragments,
  }
}
