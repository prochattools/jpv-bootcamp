import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { restoreLegacyLessonImagePlaceholders } from '@/lib/payloadContent/legacyLessonMedia'

const root = resolve(__dirname, '../..')
const renderer = readFileSync(resolve(root, 'src/components/portal/LegacyLessonRichText.tsx'), 'utf8')
const player = readFileSync(resolve(root, 'src/components/portal/ManagedBunnyVideoPlayer.tsx'), 'utf8')

describe('legacy lesson rich-text rendering contract', () => {
  it('renders only sanitized fallback HTML and never the raw source html field', () => {
    expect(renderer).toContain('restoreLegacyLessonImagePlaceholders(node.fields.safeHtml?.trim() ??')
    expect(renderer).toContain('dangerouslySetInnerHTML={{ __html: safeHtml }}')
    expect(renderer).toContain('never render node.fields.html directly')
    expect(renderer).not.toContain('dangerouslySetInnerHTML={{ __html: node.fields.html')
  })

  it('renders inline Bunny blocks through canonical GUID-aware managed playback', () => {
    expect(renderer).toContain('bunnyVideo: ({ node }) =>')
    expect(renderer).toContain('videoGuid={node.fields.videoGuid}')
    expect(renderer).toContain("target='lesson'")
    expect(player).toContain("if (target === 'lesson' && videoGuid) query.set('videoGuid', videoGuid)")
  })

  it('restores only WordPress upload placeholders to the bundled local archive path', () => {
    const safeHtml = '<p>Before</p><span data-legacy-image-preserved="true">Arrows (https://portal.jpvbootcamp.com/wp-content/uploads/2025/11/Arrows_houses.png)</span><p>After</p>'
    const restored = restoreLegacyLessonImagePlaceholders(safeHtml)
    expect(restored).toContain('src="/legacy-media/2025/11/Arrows_houses.png"')
    expect(restored).toContain('alt="Arrows"')
    expect(restored).not.toContain('data-legacy-image-preserved')
  })
})
