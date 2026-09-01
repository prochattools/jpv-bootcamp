import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'

export type PlainTextLexicalTextNode = {
  type: 'text'
  detail: 0
  format: 0
  mode: 'normal'
  style: ''
  text: string
  version: 1
}

export type PlainTextLexicalLinkNode = {
  type: 'link'
  version: 2
  url: string
  rel: 'noopener noreferrer'
  target: '_blank'
  children: PlainTextLexicalTextNode[]
}

export type PlainTextLexicalInlineNode = PlainTextLexicalTextNode | PlainTextLexicalLinkNode

export type PlainTextLexicalParagraphNode = {
  type: 'paragraph'
  format: ''
  indent: 0
  version: 1
  textFormat: 0
  textStyle: ''
  children: PlainTextLexicalInlineNode[]
}

export type PlainTextLexicalDocument = {
  root: {
    type: 'root'
    direction: 'ltr'
    format: ''
    indent: 0
    version: 1
    children: PlainTextLexicalParagraphNode[]
  }
}

export type PlainTextToLexicalOptions = {
  maxCharacters?: number
  maxParagraphs?: number
  appendText?: string | null
}

function textNode(text: string): PlainTextLexicalTextNode {
  return {
    type: 'text',
    detail: 0,
    format: 0,
    mode: 'normal',
    style: '',
    text,
    version: 1,
  }
}

function trimUrlPunctuation(value: string): { url: string; trailing: string } {
  const match = /[.,!?;:]+$/.exec(value)
  if (!match) return { url: value, trailing: '' }
  return { url: value.slice(0, -match[0].length), trailing: match[0] }
}

function inlineNodes(value: string): PlainTextLexicalInlineNode[] {
  const nodes: PlainTextLexicalInlineNode[] = []
  const urlPattern = /https?:\/\/[^\s<>"']+/gi
  let cursor = 0

  for (const match of value.matchAll(urlPattern)) {
    const rawUrl = match[0]
    const start = match.index ?? cursor
    const { url, trailing } = trimUrlPunctuation(rawUrl)
    if (!url) continue

    if (start > cursor) nodes.push(textNode(value.slice(cursor, start)))
    nodes.push({
      type: 'link',
      version: 2,
      url,
      rel: 'noopener noreferrer',
      target: '_blank',
      children: [textNode(url)],
    })
    if (trailing) nodes.push(textNode(trailing))
    cursor = start + rawUrl.length
  }

  if (cursor < value.length) nodes.push(textNode(value.slice(cursor)))
  return nodes.length > 0 ? nodes : [textNode(value)]
}

function paragraph(text: string): PlainTextLexicalParagraphNode {
  return {
    type: 'paragraph',
    format: '',
    indent: 0,
    version: 1,
    textFormat: 0,
    textStyle: '',
    children: inlineNodes(text),
  }
}

/**
 * Builds the single plain-text-to-Payload-Lexical shape used by portal
 * mutations. Blank lines are omitted and every retained line is a paragraph.
 * Paragraph caps are explicit caller contracts; character caps, when supplied,
 * reject oversized input rather than silently discarding content.
 */
export function plainTextToLexical(
  value: string,
  options: PlainTextToLexicalOptions = {},
): PlainTextLexicalDocument {
  const maxCharacters = options.maxCharacters
  if (maxCharacters !== undefined && value.length > Math.max(0, maxCharacters)) {
    throw new PortalAdminActionError('invalid_input', 'Text is too long.')
  }

  const maxParagraphs = options.maxParagraphs ?? 100
  const paragraphs = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, Math.max(0, maxParagraphs))
    .map(paragraph)

  const appended = options.appendText?.trim()
  if (appended) paragraphs.push(paragraph(appended))

  return {
    root: {
      type: 'root',
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
      children: paragraphs,
    },
  }
}
