import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'

import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
} from '@/lib/payloadCourse/accessService'
import {
  resolveMemberManagedVideo,
  resolveMemberMediaAsset,
  resolveMemberMediaAssets,
  type MemberManagedVideo,
  type MemberMediaAsset,
} from '@/lib/payloadContent/memberMedia'

export type MemberPublishedContent = {
  id: string
  title: string
  slug: string
  summary: string | null
  contentHtml: string | null
  publishedAt: string | null
  featuredImage: MemberMediaAsset | null
  gallery: MemberMediaAsset[]
  featuredVideo: MemberManagedVideo | null
  attachments: MemberMediaAsset[]
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function asContentHtml(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null

  try {
    const html = convertLexicalToHTML({
      data: value as Parameters<typeof convertLexicalToHTML>[0]['data'],
    }).trim()
    return html && html !== '<div></div>' && html !== '<div> </div>' ? html : null
  } catch {
    return null
  }
}

async function findPublishedBySlug(
  payload: PayloadCourseAccessAPI,
  collection: 'payload_pages' | 'payload_posts',
  slug: string,
): Promise<PayloadDocument | null> {
  const result = await payload.find({
    collection,
    where: {
      and: [
        { slug: { equals: slug } },
        { status: { equals: 'published' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  return result.docs[0] ?? null
}

async function projectPublishedContent(
  payload: PayloadCourseAccessAPI,
  document: PayloadDocument,
  summaryField: 'summary' | 'excerpt',
): Promise<MemberPublishedContent | null> {
  const slug = asString(document.slug)
  if (!slug) return null

  const [featuredImage, gallery, featuredVideo, attachments] = await Promise.all([
    resolveMemberMediaAsset(payload, document.featuredImage),
    resolveMemberMediaAssets(payload, document.gallery),
    resolveMemberManagedVideo(payload, document.featuredVideo),
    resolveMemberMediaAssets(payload, document.attachments),
  ])

  return {
    id: String(document.id),
    title: asString(document.title) ?? 'Untitled content',
    slug,
    summary: asString(document[summaryField]),
    contentHtml: asContentHtml(document.content),
    publishedAt: asString(document.publishedAt),
    featuredImage,
    gallery,
    featuredVideo,
    attachments,
  }
}

export async function getPublishedMemberPage(
  payload: PayloadCourseAccessAPI,
  slug: string,
): Promise<MemberPublishedContent | null> {
  const page = await findPublishedBySlug(payload, 'payload_pages', slug)
  return page ? projectPublishedContent(payload, page, 'summary') : null
}

export async function getPublishedMemberPost(
  payload: PayloadCourseAccessAPI,
  slug: string,
): Promise<MemberPublishedContent | null> {
  const post = await findPublishedBySlug(payload, 'payload_posts', slug)
  return post ? projectPublishedContent(payload, post, 'excerpt') : null
}

export type MemberPublishedContentSummary = {
  id: string
  kind: 'page' | 'post'
  title: string
  slug: string
  summary: string | null
  publishedAt: string | null
  featuredImage: MemberMediaAsset | null
}

async function listPublishedCollection(
  payload: PayloadCourseAccessAPI,
  collection: 'payload_pages' | 'payload_posts',
  kind: 'page' | 'post',
  summaryField: 'summary' | 'excerpt',
): Promise<MemberPublishedContentSummary[]> {
  const result = await payload.find({
    collection,
    where: { status: { equals: 'published' } },
    limit: 100,
    depth: 0,
    sort: '-publishedAt',
    overrideAccess: true,
  })

  const summaries: MemberPublishedContentSummary[] = []
  for (const document of result.docs) {
    const slug = asString(document.slug)
    if (!slug) continue
    summaries.push({
      id: String(document.id),
      kind,
      title: asString(document.title) ?? 'Untitled content',
      slug,
      summary: asString(document[summaryField]),
      publishedAt: asString(document.publishedAt),
      featuredImage: await resolveMemberMediaAsset(payload, document.featuredImage),
    })
  }
  return summaries
}

export async function listPublishedMemberContent(
  payload: PayloadCourseAccessAPI,
): Promise<MemberPublishedContentSummary[]> {
  const [pages, posts] = await Promise.all([
    listPublishedCollection(payload, 'payload_pages', 'page', 'summary'),
    listPublishedCollection(payload, 'payload_posts', 'post', 'excerpt'),
  ])

  return [...posts, ...pages].sort((left, right) => {
    const leftTime = left.publishedAt ? Date.parse(left.publishedAt) : 0
    const rightTime = right.publishedAt ? Date.parse(right.publishedAt) : 0
    return rightTime - leftTime
  })
}
