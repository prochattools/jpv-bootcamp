import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  announcementHTMLToLexical,
  announcementHTMLToPlainText,
  sanitizeAnnouncementHTML,
} from '@/lib/payloadContent/announcementRichText'

describe('announcement rich text', () => {
  it('keeps supported formatting and removes unsafe markup', () => {
    const html = '<p>Hello <strong>world</strong></p><script>alert(1)</script><a href="javascript:alert(1)">bad</a>'
    const sanitized = sanitizeAnnouncementHTML(html)

    expect(sanitized).toContain('<strong>world</strong>')
    expect(sanitized).not.toContain('<script>')
    expect(sanitized).not.toContain('javascript:')
    expect(announcementHTMLToPlainText(sanitized)).toBe('Hello worldbad')
  })

  it('converts supported announcement HTML to Payload Lexical state', async () => {
    const state = await announcementHTMLToLexical(
      '<h2>Update</h2><p>Read <a href="https://example.com">more</a>.</p><img src="https://example.com/image.jpg" alt="Example">',
    )

    expect(state.root.children.length).toBeGreaterThan(0)
    expect(state.root.children.some((node) => node.type === 'heading')).toBe(true)
  })
})
