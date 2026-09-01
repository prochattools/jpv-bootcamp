import {
  convertHTMLToLexical,
  EXPERIMENTAL_TableFeature,
  editorConfigFactory,
} from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { SanitizedConfig } from 'payload'
import { JSDOM } from 'jsdom'

const MAX_HTML_LENGTH = 200_000
const minimalSanitizedConfig = {
  collections: [],
  globals: [],
} as unknown as SanitizedConfig

const SAFE_TAGS = new Set([
  'a', 'b', 'blockquote', 'br', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'i', 'li', 'ol', 'p', 's', 'span', 'strong', 'u', 'ul', 'img',
  'caption', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr',
])
const REMOVE_TAGS = new Set(['audio', 'canvas', 'embed', 'form', 'iframe', 'object', 'script', 'style', 'svg', 'video'])

let editorConfigPromise: ReturnType<typeof editorConfigFactory.fromFeatures> | undefined

async function getEditorConfig() {
  editorConfigPromise ??= editorConfigFactory.fromFeatures({
    config: minimalSanitizedConfig,
    features: ({ defaultFeatures }) => [
      ...defaultFeatures,
      EXPERIMENTAL_TableFeature(),
    ],
  })
  return editorConfigPromise
}

function safeUrl(value: string, allowImage = false): string | null {
  const candidate = value.trim()
  if (!candidate || /^javascript:/i.test(candidate) || /^data:/i.test(candidate)) return null
  if (candidate.startsWith('/') && !candidate.startsWith('//')) return candidate
  try {
    const parsed = new URL(candidate)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    if (!allowImage && parsed.username) return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function sanitizeAnnouncementHTML(source: string): string {
  const dom = new JSDOM(source.slice(0, MAX_HTML_LENGTH), { url: 'https://jpvbootcamp.com/' })
  const document = dom.window.document

  for (const element of Array.from(document.body.querySelectorAll('*'))) {
    const tag = element.tagName.toLowerCase()
    if (REMOVE_TAGS.has(tag)) {
      element.remove()
      continue
    }
    if (!SAFE_TAGS.has(tag)) {
      element.replaceWith(...Array.from(element.childNodes))
      continue
    }

    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const allowed = (tag === 'a' && (name === 'href' || name === 'target' || name === 'rel'))
        || (tag === 'img' && (name === 'src' || name === 'alt' || name === 'width' || name === 'height' || name === 'data-lexical-upload-id' || name === 'data-lexical-upload-relation-to'))
      if (!allowed || name.startsWith('on')) element.removeAttribute(attribute.name)
    }

    if (tag === 'a') {
      const href = safeUrl(element.getAttribute('href') ?? '')
      if (!href) element.removeAttribute('href')
      else element.setAttribute('href', href)
      element.setAttribute('rel', 'noreferrer noopener')
      if (element.getAttribute('target') !== '_self') element.setAttribute('target', '_blank')
    }
    if (tag === 'img') {
      const src = safeUrl(element.getAttribute('src') ?? '', true)
      const relation = element.getAttribute('data-lexical-upload-relation-to')
      const uploadId = element.getAttribute('data-lexical-upload-id')
      if (!src) {
        element.remove()
        continue
      }
      element.setAttribute('src', src)
      element.setAttribute('alt', (element.getAttribute('alt') ?? 'Announcement image').slice(0, 250))
      if (relation !== 'payload_media' || !uploadId) {
        element.removeAttribute('data-lexical-upload-relation-to')
        element.removeAttribute('data-lexical-upload-id')
      }
    }
  }

  return document.body.innerHTML.slice(0, MAX_HTML_LENGTH)
}

export function announcementHTMLToPlainText(source: string): string {
  const dom = new JSDOM(sanitizeAnnouncementHTML(source))
  return (dom.window.document.body.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 20_000)
}

export async function announcementHTMLToLexical(source: string): Promise<SerializedEditorState> {
  const editorConfig = await getEditorConfig()
  return convertHTMLToLexical({
    editorConfig,
    html: sanitizeAnnouncementHTML(source),
    JSDOM,
  }) as SerializedEditorState
}
