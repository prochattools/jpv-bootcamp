import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (path: string) => readFileSync(resolve(path), 'utf8')

describe('Payload operator uplink schema', () => {
  it('supports publishable pages with managed images and Bunny video', () => {
    const source = readSource('src/collections/PayloadPages.ts')

    expect(source).toContain("name: 'featuredImage'")
    expect(source).toContain("name: 'gallery'")
    expect(source).toContain("name: 'featuredVideo'")
    expect(source).toContain("relationTo: 'bunny_videos'")
    expect(source).toContain("value: 'published'")
    expect(source).toContain("value: 'archived'")
  })

  it('supports posts with pictures, downloads and managed video', () => {
    const source = readSource('src/collections/PayloadPosts.ts')

    expect(source).toContain("name: 'featuredImage'")
    expect(source).toContain("name: 'gallery'")
    expect(source).toContain("name: 'attachments'")
    expect(source).toContain("name: 'featuredVideo'")
    expect(source).toContain("relationTo: 'bunny_videos'")
  })

  it('keeps compatibility access and video controls hidden from operators', () => {
    const source = readSource('src/collections/PayloadCoursePrototype.ts')

    expect(source).not.toContain("defaultColumns: ['title', 'status', 'visibility', 'accessBadge', 'updatedAt']")
    expect(source).toMatch(/name: 'accessBadge'[\s\S]*?hidden: true/)
    expect(source).toMatch(/name: 'videoProviderLabel'[\s\S]*?hidden: true/)
    expect(source).toMatch(/name: 'videoIdOrPreviewUrl'[\s\S]*?hidden: true/)
    expect(source).toMatch(/name: 'bunnyVideo'[\s\S]*?relationTo: 'bunny_videos'/)
    expect(source).toMatch(/name: 'coverImage'[\s\S]*?relationTo: 'payload_media'/)
  })
})
