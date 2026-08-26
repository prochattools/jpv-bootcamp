export type PlainTextRichTextTextNode = {
  type: 'text'
  detail: 0
  format: 0
  mode: 'normal'
  style: ''
  text: string
  version: 1
}

export type PlainTextRichTextParagraphNode = {
  type: 'paragraph'
  format: ''
  indent: 0
  version: 1
  textFormat: 0
  textStyle: ''
  children: PlainTextRichTextTextNode[]
}

export type PlainTextRichTextDocument = {
  root: {
    type: 'root'
    format: ''
    indent: 0
    version: 1
    children: PlainTextRichTextParagraphNode[]
  }
}

export function buildPlainTextRichText(text: string, videoUrl: string | null = null): PlainTextRichTextDocument {
  const paragraphs = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 100)
  const children = paragraphs.map((line) => ({
    type: 'paragraph' as const,
    format: '' as const,
    indent: 0 as const,
    version: 1 as const,
    textFormat: 0 as const,
    textStyle: '' as const,
    children: [{ type: 'text' as const, detail: 0 as const, format: 0 as const, mode: 'normal' as const, style: '' as const, text: line, version: 1 as const }],
  }))
  if (videoUrl) {
    children.push({
      type: 'paragraph' as const,
      format: '' as const,
      indent: 0 as const,
      version: 1 as const,
      textFormat: 0 as const,
      textStyle: '' as const,
      children: [{ type: 'text' as const, detail: 0 as const, format: 0 as const, mode: 'normal' as const, style: '' as const, text: `Video: ${videoUrl}`, version: 1 as const }],
    })
  }
  return { root: { type: 'root', format: '', indent: 0, version: 1, children } }
}
