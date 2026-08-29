import {
  plainTextToLexical,
  type PlainTextLexicalDocument,
  type PlainTextLexicalParagraphNode,
  type PlainTextLexicalTextNode,
} from '@/lib/content/plainTextToLexical'

export type PlainTextRichTextTextNode = PlainTextLexicalTextNode
export type PlainTextRichTextParagraphNode = PlainTextLexicalParagraphNode
export type PlainTextRichTextDocument = PlainTextLexicalDocument

export function buildPlainTextRichText(text: string, videoUrl: string | null = null): PlainTextRichTextDocument {
  return plainTextToLexical(text, {
    maxParagraphs: 100,
    appendText: videoUrl ? `Video: ${videoUrl}` : null,
  })
}
