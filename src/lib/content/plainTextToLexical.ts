export type PlainTextLexicalTextNode = {
  type: 'text'
  detail: 0
  format: 0
  mode: 'normal'
  style: ''
  text: string
  version: 1
}

export type PlainTextLexicalParagraphNode = {
  type: 'paragraph'
  format: ''
  indent: 0
  version: 1
  textFormat: 0
  textStyle: ''
  children: PlainTextLexicalTextNode[]
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

function paragraph(text: string): PlainTextLexicalParagraphNode {
  return {
    type: 'paragraph',
    format: '',
    indent: 0,
    version: 1,
    textFormat: 0,
    textStyle: '',
    children: [{
      type: 'text',
      detail: 0,
      format: 0,
      mode: 'normal',
      style: '',
      text,
      version: 1,
    }],
  }
}

/**
 * Builds the single plain-text-to-Payload-Lexical shape used by portal
 * mutations. Blank lines are omitted and every retained line is a paragraph.
 */
export function plainTextToLexical(
  value: string,
  options: PlainTextToLexicalOptions = {},
): PlainTextLexicalDocument {
  const maxCharacters = options.maxCharacters ?? 50_000
  const maxParagraphs = options.maxParagraphs ?? 100
  const source = value.slice(0, Math.max(0, maxCharacters))
  const paragraphs = source
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
