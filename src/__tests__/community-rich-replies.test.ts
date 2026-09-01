import { describe, expect, it } from 'vitest'

import { plainTextToLexical } from '@/lib/content/plainTextToLexical'
import { projectCommunityRichText } from '@/lib/payloadCourse/communityDiscussion'
import { safeCommunityVideoEmbed } from '@/lib/payloadCourse/communityRichMedia'

describe('community rich replies', () => {
  it('turns pasted HTTP URLs into safe clickable Lexical links', () => {
    const document = plainTextToLexical('Watch https://youtu.be/dQw4w9WgXcQ.')
    const children = document.root.children[0]?.children ?? []

    expect(children).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'link', url: 'https://youtu.be/dQw4w9WgXcQ' }),
      expect.objectContaining({ type: 'text', text: '.' }),
    ]))
  })

  it('normalizes supported video providers to constrained embed URLs', () => {
    expect(safeCommunityVideoEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      provider: 'youtube',
      src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    })
    expect(safeCommunityVideoEmbed('https://vimeo.com/12345678')).toEqual({
      provider: 'vimeo',
      src: 'https://player.vimeo.com/video/12345678',
    })
    expect(safeCommunityVideoEmbed('https://example.com/video.mp4')).toBeNull()
  })

  it('projects generated YouTube embeds while rejecting unknown iframes', () => {
    const youtube = projectCommunityRichText({
      root: {
        type: 'root',
        children: [{
          type: 'block',
          fields: {
            blockType: 'legacyHTML',
            safeHtml: '<div><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe></div>',
          },
        }],
      },
    })
    expect(youtube).toEqual({
      type: 'root',
      children: [{
        type: 'legacy-external-embed',
        provider: 'youtube',
        src: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
      }],
    })

    const unsafe = projectCommunityRichText({
      root: {
        type: 'root',
        children: [{
          type: 'block',
          fields: {
            blockType: 'legacyHTML',
            safeHtml: '<iframe src="https://evil.example/video"></iframe>',
          },
        }],
      },
    })
    expect(unsafe).toEqual({ type: 'root', children: [] })
  })
})
