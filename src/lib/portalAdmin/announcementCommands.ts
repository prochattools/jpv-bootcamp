import type { PayloadCourseAccessAPI, PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import { boundedText, validateTitle } from '@/lib/domain/validation'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import {
  announcementHTMLToLexical,
  announcementHTMLToPlainText,
  sanitizeAnnouncementHTML,
} from '@/lib/payloadContent/announcementRichText'
import { parseMemberContentTargets, type MemberContentAudience } from '@/lib/payloadContent/audience'
import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'

export type PortalAnnouncementUpdateInput = {
  title: string
  excerpt?: string
  bodyHtml: string
  expectedUpdatedAt?: string | null
}

export type PortalAdminUpdateSummary = {
  id: string
  title: string
  slug: string
  excerpt: string | null
  bodyHtml: string | null
  status: 'draft' | 'published' | 'archived'
  audience: MemberContentAudience
  publishedAt: string | null
  updatedAt: string | null
}

function text(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function audienceFor(document: PayloadDocument): MemberContentAudience {
  const targets = parseMemberContentTargets(document.targetMemberIds)
  if (document.audience === 'groups' || (document.audience === 'selected' && targets.groupIds.length > 0)) return 'groups'
  return document.audience === 'selected' ? 'selected' : 'all'
}

function summary(document: PayloadDocument, options: { includeBody?: boolean } = {}): PortalAdminUpdateSummary {
  const status = document.status === 'published' || document.status === 'archived' ? document.status : 'draft'
  let bodyHtml: string | null = null
  if (options.includeBody !== false && document.content && typeof document.content === 'object') {
    try {
      const rendered = convertLexicalToHTML({
        data: document.content as Parameters<typeof convertLexicalToHTML>[0]['data'],
      }).trim()
      const safeRendered = sanitizeAnnouncementHTML(rendered)
      bodyHtml = safeRendered && safeRendered !== '<div></div>' && safeRendered !== '<div> </div>'
        ? safeRendered
        : null
    } catch {
      bodyHtml = null
    }
  }
  return {
    id: String(document.id),
    title: text(document.title) ?? 'Untitled update',
    slug: text(document.slug) ?? '',
    excerpt: text(document.excerpt),
    bodyHtml,
    status,
    audience: audienceFor(document),
    publishedAt: text(document.publishedAt),
    updatedAt: text(document.updatedAt),
  }
}

async function findAll(payload: PayloadCourseAccessAPI): Promise<PayloadDocument[]> {
  const documents: PayloadDocument[] = []
  let page = 1
  do {
    const result = await payload.find({
      collection: 'payload_posts',
      limit: 100,
      page,
      depth: 0,
      sort: '-updatedAt',
      overrideAccess: true,
    })
    documents.push(...(result.docs as PayloadDocument[]))
    if (!result.hasNextPage || page >= 1000) break
    page += 1
  } while (true)
  return documents
}

export async function listPortalAdminUpdates(
  payload: PayloadCourseAccessAPI,
): Promise<PortalAdminUpdateSummary[]> {
  return (await findAll(payload)).map((document) => summary(document, { includeBody: false }))
}

async function updateWithPrecondition(
  payload: PayloadCourseWriteAPI,
  postId: string,
  data: Record<string, unknown>,
  expectedUpdatedAt?: string | null,
): Promise<PayloadDocument> {
  if (expectedUpdatedAt === undefined) {
    return await payload.update({
      collection: 'payload_posts',
      id: postId,
      data,
      overrideAccess: true,
      overrideLock: true,
    }) as PayloadDocument
  }

  const result = await (payload.update as unknown as (args: Record<string, unknown>) => Promise<unknown>)({
    collection: 'payload_posts',
    where: {
      and: [
        { id: { equals: postId } },
        { updatedAt: { equals: expectedUpdatedAt } },
      ],
    },
    limit: 1,
    data,
    overrideAccess: true,
    overrideLock: true,
  })
  const documents = result && typeof result === 'object' && Array.isArray((result as { docs?: unknown[] }).docs)
    ? (result as { docs: unknown[] }).docs
    : []
  if (documents.length !== 1) {
    throw new PortalAdminActionError('conflict', 'This update changed in another session. Refresh and try again.')
  }
  return documents[0] as PayloadDocument
}

async function getPost(payload: PayloadCourseWriteAPI, postId: string): Promise<PayloadDocument> {
  const post = await payload.findByID({
    collection: 'payload_posts',
    id: postId,
    depth: 0,
    overrideAccess: true,
  }) as PayloadDocument | null
  if (!post) throw new PortalAdminActionError('not_found', 'Update not found.')
  return post
}

export async function getPortalAdminUpdateCommand(
  payload: PayloadCourseWriteAPI,
  postId: string,
): Promise<PortalAdminUpdateSummary> {
  return summary(await getPost(payload, postId))
}

export async function updatePortalAnnouncementCommand(
  payload: PayloadCourseWriteAPI,
  actorId: string,
  postId: string,
  input: PortalAnnouncementUpdateInput,
): Promise<PortalAdminUpdateSummary> {
  const before = await getPost(payload, postId)
  const title = validateTitle(input.title)
  const bodyHtml = typeof input.bodyHtml === 'string' ? input.bodyHtml.trim() : ''
  const body = announcementHTMLToPlainText(bodyHtml)
  if (!body) throw new PortalAdminActionError('invalid_input', 'Title and update text are required.')
  const excerpt = typeof input.excerpt === 'string' && input.excerpt.trim()
    ? boundedText(input.excerpt, 'Short summary', 2000)
    : body.slice(0, 240)
  const updated = await updateWithPrecondition(payload, postId, {
    title,
    excerpt,
    content: await announcementHTMLToLexical(bodyHtml),
  }, input.expectedUpdatedAt)
  await createAuditEvent(payload, {
    actorType: 'admin',
    actorId,
    action: 'portal_update.updated',
    targetCollection: 'payload_posts',
    targetId: postId,
    before: { title: before.title, status: before.status },
    after: { title, status: updated.status },
  })
  return summary(updated)
}

export async function archivePortalAnnouncementCommand(
  payload: PayloadCourseWriteAPI,
  actorId: string,
  postId: string,
  expectedUpdatedAt?: string | null,
): Promise<PortalAdminUpdateSummary> {
  const before = await getPost(payload, postId)
  const updated = await updateWithPrecondition(payload, postId, { status: 'archived' }, expectedUpdatedAt)
  await createAuditEvent(payload, {
    actorType: 'admin',
    actorId,
    action: 'portal_update.archived',
    targetCollection: 'payload_posts',
    targetId: postId,
    before: { title: before.title, status: before.status },
    after: { title: updated.title, status: 'archived' },
  })
  return summary(updated)
}

export async function deletePortalAnnouncementCommand(
  payload: PayloadCourseWriteAPI,
  actorId: string,
  postId: string,
  confirmed: boolean,
  expectedUpdatedAt?: string | null,
): Promise<void> {
  if (!confirmed) throw new PortalAdminActionError('invalid_input', 'Deletion requires explicit confirmation.')
  const post = await getPost(payload, postId)
  if (!payload.delete) throw new PortalAdminActionError('internal_error', 'Update deletion is unavailable.')
  if (expectedUpdatedAt === undefined) {
    await payload.delete({ collection: 'payload_posts', id: postId, overrideAccess: true })
  } else {
    const result = await (payload.delete as unknown as (args: Record<string, unknown>) => Promise<unknown>)({
      collection: 'payload_posts',
      where: {
        and: [
          { id: { equals: postId } },
          { updatedAt: { equals: expectedUpdatedAt } },
        ],
      },
      overrideAccess: true,
    })
    const documents = result && typeof result === 'object' && Array.isArray((result as { docs?: unknown[] }).docs)
      ? (result as { docs: unknown[] }).docs
      : []
    if (documents.length !== 1) {
      throw new PortalAdminActionError('conflict', 'This update changed in another session. Refresh and try again.')
    }
  }
  await createAuditEvent(payload, {
    actorType: 'admin',
    actorId,
    action: 'portal_update.deleted',
    targetCollection: 'payload_posts',
    targetId: postId,
    before: { title: post.title, status: post.status },
  })
}
