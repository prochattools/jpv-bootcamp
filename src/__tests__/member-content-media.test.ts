import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  getPublishedMemberPage,
  getPublishedMemberPost,
  listPublishedMemberContent,
} from '@/lib/payloadContent/memberContent'
import {
  asSafeMemberMediaUrl,
  resolveMemberMediaAsset,
  resolveMemberMediaAssets,
} from '@/lib/payloadContent/memberMedia'
import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
  PayloadId,
} from '@/lib/payloadCourse/accessService'

type CollectionMap = Record<string, PayloadDocument[]>

function relationId(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: PayloadId }).id)
  }
  return String(value)
}

function matches(doc: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((item) => matches(doc, item as Record<string, unknown>))
  }

  return Object.entries(where).every(([field, condition]) => {
    const record = condition as { equals?: unknown }
    return 'equals' in record ? relationId(doc[field]) === String(record.equals) : false
  })
}

class FakePayload implements PayloadCourseAccessAPI {
  constructor(private readonly collections: CollectionMap) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
  }) {
    const docs = (this.collections[args.collection] ?? []).filter((doc) => matches(doc, args.where))
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const document = (this.collections[args.collection] ?? []).find(
      (item) => String(item.id) === String(args.id),
    )
    if (!document) throw new Error('missing relationship')
    return document
  }
}

function buildPayload() {
  return new FakePayload({
    payload_media: [
      {
        id: 'hero',
        url: '/media/hero.jpg',
        alt: 'Hero image',
        filename: 'hero.jpg',
        mimeType: 'image/jpeg',
        filesize: 2048,
        width: 1200,
        height: 800,
      },
      {
        id: 'download',
        url: 'https://assets.example.com/guide.pdf',
        alt: 'Member guide',
        filename: 'guide.pdf',
        mimeType: 'application/pdf',
        filesize: 4096,
      },
      {
        id: 'unsafe',
        url: 'javascript:alert(1)',
        alt: 'Unsafe',
      },
    ],
    bunny_videos: [
      {
        id: 'video-ready',
        title: 'Welcome video',
        status: 'ready',
        thumbnailUrl: 'https://assets.example.com/thumb.jpg',
        duration: 90,
      },
    ],
    payload_pages: [
      {
        id: 'page-1',
        title: 'Member welcome',
        slug: 'welcome',
        status: 'published',
        summary: 'Welcome to the programme.',
        featuredImage: 'hero',
        gallery: ['hero', 'missing', 'unsafe'],
        featuredVideo: 'video-ready',
      },
      {
        id: 'page-draft',
        title: 'Draft',
        slug: 'draft',
        status: 'draft',
      },
    ],
    payload_posts: [
      {
        id: 'post-1',
        title: 'Resources',
        slug: 'resources',
        status: 'published',
        excerpt: 'Useful files.',
        attachments: ['download'],
      },
    ],
  })
}

describe('member content media projections', () => {
  it('accepts relative and HTTP(S) media URLs only', () => {
    expect(asSafeMemberMediaUrl('/media/image.jpg')).toBe('/media/image.jpg')
    expect(asSafeMemberMediaUrl('https://assets.example.com/image.jpg')).toBe(
      'https://assets.example.com/image.jpg',
    )
    expect(asSafeMemberMediaUrl('//evil.example.com/image.jpg')).toBeNull()
    expect(asSafeMemberMediaUrl('javascript:alert(1)')).toBeNull()
  })

  it('resolves relationships safely and filters missing or unsafe media', async () => {
    const payload = buildPayload()

    expect((await resolveMemberMediaAsset(payload, 'hero'))?.alt).toBe('Hero image')
    expect(await resolveMemberMediaAsset(payload, 'missing')).toBeNull()
    expect(await resolveMemberMediaAsset(payload, 'unsafe')).toBeNull()
    expect(await resolveMemberMediaAssets(payload, ['hero', 'missing', 'unsafe'])).toHaveLength(1)
  })

  it('projects published pages with images, galleries, and managed video', async () => {
    const page = await getPublishedMemberPage(buildPayload(), 'welcome')

    expect(page?.featuredImage?.url).toBe('/media/hero.jpg')
    expect(page?.gallery).toHaveLength(1)
    expect(page?.featuredVideo).toMatchObject({
      title: 'Welcome video',
      status: 'ready',
    })
    expect(await getPublishedMemberPage(buildPayload(), 'draft')).toBeNull()
  })

  it('projects published post attachments', async () => {
    const post = await getPublishedMemberPost(buildPayload(), 'resources')

    expect(post?.attachments).toHaveLength(1)
    expect(post?.attachments[0]?.filename).toBe('guide.pdf')
  })

  it('lists only published Pages and Posts for member discovery', async () => {
    const content = await listPublishedMemberContent(buildPayload())

    expect(content.map((item) => `${item.kind}:${item.slug}`)).toEqual([
      'post:resources',
      'page:welcome',
    ])
    expect(content.some((item) => item.slug === 'draft')).toBe(false)
  })

  it('wires Page, Post, Course, and Lesson routes to managed media renderers', () => {
    const pageRoute = readFileSync(resolve('src/app/(frontend)/portal/pages/[pageSlug]/page.tsx'), 'utf8')
    const postRoute = readFileSync(resolve('src/app/(frontend)/portal/posts/[postSlug]/page.tsx'), 'utf8')
    const courseRoute = readFileSync(resolve('src/app/(frontend)/portal/courses/[courseSlug]/page.tsx'), 'utf8')
    const lessonRoute = readFileSync(
      resolve('src/app/(frontend)/portal/courses/[courseSlug]/lessons/[lessonSlug]/page.tsx'),
      'utf8',
    )
    const contentRoute = readFileSync(resolve('src/app/(frontend)/portal/content/page.tsx'), 'utf8')
    const contentCardImage = readFileSync(resolve('src/components/portal/ContentCardImage.tsx'), 'utf8')
    const portalNavigation = readFileSync(resolve('src/components/portal/PortalSidebar.tsx'), 'utf8')

    expect(pageRoute).toContain("target='page'")
    expect(postRoute).toContain("target='post'")
    expect(courseRoute).toContain('<MemberFeaturedImage asset={course.coverImage} />')
    expect(lessonRoute).toContain('<MemberFeaturedImage asset={detail.lesson.coverImage} />')
    expect(lessonRoute).toContain('status={detail.lesson.managedVideo?.status}')
    expect(contentRoute).toContain('listPublishedMemberContent')
    expect(contentRoute).toContain('<ContentCardImage')
    expect(contentCardImage).toContain('onError={() => setFailed(true)}')
    expect(contentCardImage).toContain("role='img'")
    expect(contentCardImage).toContain("aria-label={alt || 'Image unavailable'}")
    expect(contentCardImage).toContain("className='h-52 w-full object-cover'")
    expect(portalNavigation).toContain("'/portal/content'")
    expect(portalNavigation).toContain("aria-current={active ? 'page' : undefined}")
  })
})
