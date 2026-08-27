'use server'

import { revalidatePath } from 'next/cache'

import { requirePortalAdmin } from '@/lib/auth/requirePortalAdmin'
import {
  failure,
  normalizePortalAdminError,
  PortalAdminActionError,
  success,
  type PortalAdminActionResult,
} from '@/lib/portalAdmin/actionResult'
import { createAuditEvent } from '@/lib/payloadCourse/events'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult = PortalAdminActionResult<{ id?: string }>

type SpaceInput = {
  name: string
  slug: string
  description?: string
  status?: 'draft' | 'published' | 'archived'
  visibility?: 'public' | 'members' | 'private' | 'secret'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateSlug(slug: string): string {
  const normalized = slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (!normalized || normalized.length < 2) throw new PortalAdminActionError('invalid_input', 'Slug must be at least 2 characters.')
  if (normalized.length > 100) throw new PortalAdminActionError('invalid_input', 'Slug is too long.')
  return normalized
}

function spacePath(spaceSlug: string) {
  return `/portal/community/${encodeURIComponent(spaceSlug)}`
}

// ---------------------------------------------------------------------------
// Space management
// ---------------------------------------------------------------------------

export async function createSpaceAction(input: SpaceInput): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')
    const name = input.name.trim()
    if (!name) return failure('invalid_input', 'Name is required.')
    const slug = validateSlug(input.slug)

    const existing = await payload.find({
      collection: 'payload_spaces',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      ...privilegedAccess,
    })
    if (existing.docs.length > 0) return failure('conflict', 'A space with this slug already exists.')

    const doc = await payload.create({
      collection: 'payload_spaces',
      data: {
        name,
        slug,
        description: input.description?.trim() || undefined,
        status: input.status ?? 'published',
        visibility: input.visibility ?? 'members',
      },
      ...privilegedAccess,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'space.created',
      targetCollection: 'payload_spaces',
      targetId: doc.id,
      after: { name, slug },
    })

    revalidatePath('/portal/community')
    return success({ id: String(doc.id) })
  } catch (err) {
    return normalizePortalAdminError(err, 'createSpaceAction')
  }
}

export async function updateSpaceAction(
  spaceId: string,
  input: Partial<SpaceInput>,
): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')

    const before = await payload.findByID({
      collection: 'payload_spaces',
      id: spaceId,
      depth: 0,
      ...privilegedAccess,
    })
    if (!before) return failure('not_found', 'Space not found.')

    const data: Record<string, unknown> = {}
    if (input.name !== undefined) {
      const name = input.name.trim()
      if (!name) return failure('invalid_input', 'Name is required.')
      data.name = name
    }
    if (input.slug !== undefined) {
      const slug = validateSlug(input.slug)
      const existing = await payload.find({
        collection: 'payload_spaces',
        where: { and: [{ slug: { equals: slug } }, { id: { not_equals: spaceId } }] },
        limit: 1,
        depth: 0,
        ...privilegedAccess,
      })
      if (existing.docs.length > 0)
        return failure('conflict', 'A space with this slug already exists.')
      data.slug = slug
    }
    if (input.description !== undefined) data.description = input.description.trim()
    if (input.status !== undefined) data.status = input.status
    if (input.visibility !== undefined) data.visibility = input.visibility

    await payload.update({
      collection: 'payload_spaces',
      id: spaceId,
      data,
      ...privilegedAccess,
      overrideLock: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'space.updated',
      targetCollection: 'payload_spaces',
      targetId: spaceId,
      before: { name: before.name, slug: before.slug, status: before.status },
      after: data,
    })

    revalidatePath('/portal/community')
    if (before.slug) revalidatePath(spacePath(String(before.slug)))
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'updateSpaceAction')
  }
}

export async function archiveSpaceAction(spaceId: string): Promise<ActionResult> {
  return updateSpaceAction(spaceId, { status: 'archived' })
}

export async function restoreSpaceAction(spaceId: string): Promise<ActionResult> {
  return updateSpaceAction(spaceId, { status: 'published' })
}

export async function deleteSpaceAction(spaceId: string, confirmed: boolean): Promise<ActionResult> {
  try {
    if (!confirmed) return failure('invalid_input', 'Deletion requires explicit confirmation.')
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')

    const space = await payload.findByID({
      collection: 'payload_spaces',
      id: spaceId,
      depth: 0,
      ...privilegedAccess,
    })
    if (!space) return failure('not_found', 'Space not found.')

    const posts = await payload.find({
      collection: 'payload_space_posts',
      where: { space: { equals: spaceId } },
      limit: 1,
      depth: 0,
      ...privilegedAccess,
    })
    if (posts.docs.length > 0) return failure('dependency_blocked', 'Cannot delete space with existing posts. Archive it instead.')

    const memberships = await payload.find({
      collection: 'payload_space_memberships',
      where: { space: { equals: spaceId } },
      limit: 1,
      depth: 0,
      ...privilegedAccess,
    })
    if (memberships.docs.length > 0) return failure('dependency_blocked', 'Cannot delete space with memberships. Archive it instead.')

    await payload.delete({
      collection: 'payload_spaces',
      id: spaceId,
      ...privilegedAccess,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'space.deleted',
      targetCollection: 'payload_spaces',
      targetId: spaceId,
      before: { name: space.name, slug: space.slug },
    })

    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'deleteSpaceAction')
  }
}

// ---------------------------------------------------------------------------
// Post moderation
// ---------------------------------------------------------------------------

export async function adminPinPostAction(postId: string, expectedSpaceId: string): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')

    const post = await payload.findByID({
      collection: 'payload_space_posts',
      id: postId,
      depth: 0,
      ...privilegedAccess,
    })
    if (!post) return failure('not_found', 'Post not found.')

    const postSpaceId = typeof post.space === 'object' && post.space !== null
      ? String((post.space as Record<string, unknown>).id)
      : String(post.space)
    if (postSpaceId !== expectedSpaceId) return failure('invalid_input', 'Post does not belong to the specified space.')

    await payload.update({
      collection: 'payload_space_posts',
      id: postId,
      data: { pinned: true },
      ...privilegedAccess,
      overrideLock: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'post.pinned',
      targetCollection: 'payload_space_posts',
      targetId: postId,
      before: { pinned: post.pinned },
      after: { pinned: true },
    })

    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminPinPostAction')
  }
}

export async function adminUnpinPostAction(postId: string, expectedSpaceId: string): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')

    const post = await payload.findByID({ collection: 'payload_space_posts', id: postId, depth: 0, ...privilegedAccess })
    if (!post) return failure('not_found', 'Post not found.')
    const postSpaceId = typeof post.space === 'object' && post.space !== null
      ? String((post.space as Record<string, unknown>).id)
      : String(post.space)
    if (postSpaceId !== expectedSpaceId) return failure('invalid_input', 'Post does not belong to the specified space.')

    await payload.update({
      collection: 'payload_space_posts',
      id: postId,
      data: { pinned: false },
      ...privilegedAccess,
      overrideLock: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'post.unpinned',
      targetCollection: 'payload_space_posts',
      targetId: postId,
      after: { pinned: false },
    })

    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminUnpinPostAction')
  }
}

export async function adminLockPostAction(postId: string, expectedSpaceId: string): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')

    const post = await payload.findByID({ collection: 'payload_space_posts', id: postId, depth: 0, ...privilegedAccess })
    if (!post) return failure('not_found', 'Post not found.')
    const postSpaceId = typeof post.space === 'object' && post.space !== null
      ? String((post.space as Record<string, unknown>).id)
      : String(post.space)
    if (postSpaceId !== expectedSpaceId) return failure('invalid_input', 'Post does not belong to the specified space.')

    await payload.update({
      collection: 'payload_space_posts',
      id: postId,
      data: { locked: true },
      ...privilegedAccess,
      overrideLock: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'post.locked',
      targetCollection: 'payload_space_posts',
      targetId: postId,
      after: { locked: true },
    })

    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminLockPostAction')
  }
}

export async function adminUnlockPostAction(postId: string, expectedSpaceId: string): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')

    const post = await payload.findByID({ collection: 'payload_space_posts', id: postId, depth: 0, ...privilegedAccess })
    if (!post) return failure('not_found', 'Post not found.')
    const postSpaceId = typeof post.space === 'object' && post.space !== null
      ? String((post.space as Record<string, unknown>).id)
      : String(post.space)
    if (postSpaceId !== expectedSpaceId) return failure('invalid_input', 'Post does not belong to the specified space.')

    await payload.update({
      collection: 'payload_space_posts',
      id: postId,
      data: { locked: false },
      ...privilegedAccess,
      overrideLock: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'post.unlocked',
      targetCollection: 'payload_space_posts',
      targetId: postId,
      after: { locked: false },
    })

    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminUnlockPostAction')
  }
}

export async function adminHidePostAction(postId: string, expectedSpaceId: string): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')

    const post = await payload.findByID({
      collection: 'payload_space_posts',
      id: postId,
      depth: 0,
      ...privilegedAccess,
    })
    if (!post) return failure('not_found', 'Post not found.')

    const postSpaceId = typeof post.space === 'object' && post.space !== null
      ? String((post.space as Record<string, unknown>).id)
      : String(post.space)
    if (postSpaceId !== expectedSpaceId) return failure('invalid_input', 'Post does not belong to the specified space.')

    await payload.update({
      collection: 'payload_space_posts',
      id: postId,
      data: { moderationStatus: 'hidden' },
      ...privilegedAccess,
      overrideLock: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'post.hidden',
      targetCollection: 'payload_space_posts',
      targetId: postId,
      before: { moderationStatus: post.moderationStatus },
      after: { moderationStatus: 'hidden' },
    })

    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminHidePostAction')
  }
}

export async function adminUnhidePostAction(postId: string, expectedSpaceId: string): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')

    const post = await payload.findByID({ collection: 'payload_space_posts', id: postId, depth: 0, ...privilegedAccess })
    if (!post) return failure('not_found', 'Post not found.')
    const postSpaceId = typeof post.space === 'object' && post.space !== null
      ? String((post.space as Record<string, unknown>).id)
      : String(post.space)
    if (postSpaceId !== expectedSpaceId) return failure('invalid_input', 'Post does not belong to the specified space.')

    await payload.update({
      collection: 'payload_space_posts',
      id: postId,
      data: { moderationStatus: 'visible' },
      ...privilegedAccess,
      overrideLock: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'post.unhidden',
      targetCollection: 'payload_space_posts',
      targetId: postId,
      after: { moderationStatus: 'visible' },
    })

    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminUnhidePostAction')
  }
}

export async function adminDeletePostAction(
  postId: string,
  confirmed: boolean,
  expectedSpaceId: string,
): Promise<ActionResult> {
  try {
    if (!confirmed) return failure('invalid_input', 'Deletion requires explicit confirmation.')
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')

    const post = await payload.findByID({
      collection: 'payload_space_posts',
      id: postId,
      depth: 0,
      ...privilegedAccess,
    })
    if (!post) return failure('not_found', 'Post not found.')

    const postSpaceId = typeof post.space === 'object' && post.space !== null
      ? String((post.space as Record<string, unknown>).id)
      : String(post.space)
    if (postSpaceId !== expectedSpaceId) return failure('invalid_input', 'Post does not belong to the specified space.')

    const comments = await payload.find({
      collection: 'payload_space_comments',
      where: { post: { equals: postId } },
      limit: 1,
      depth: 0,
      ...privilegedAccess,
    })
    if (comments.docs.length > 0)
      return failure('dependency_blocked', 'Cannot delete post with comments. Hide it instead.')

    if (!payload.delete) throw new Error('delete not available on this payload instance')
    await payload.delete({
      collection: 'payload_space_posts',
      id: postId,
      ...privilegedAccess,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'post.deleted',
      targetCollection: 'payload_space_posts',
      targetId: postId,
      before: { title: post.title },
    })

    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminDeletePostAction')
  }
}

export async function adminEditPostAction(
  postId: string,
  input: { title?: string; body?: string | { root: unknown } },
  expectedSpaceId: string,
): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')

    const post = await payload.findByID({
      collection: 'payload_space_posts',
      id: postId,
      depth: 0,
      ...privilegedAccess,
    })
    if (!post) return failure('not_found', 'Post not found.')

    const postSpaceId = typeof post.space === 'object' && post.space !== null
      ? String((post.space as Record<string, unknown>).id)
      : String(post.space)
    if (postSpaceId !== expectedSpaceId) return failure('invalid_input', 'Post does not belong to the specified space.')

    const data: Record<string, unknown> = {}
    if (input.title !== undefined) {
      const trimmed = input.title.trim()
      if (!trimmed) return failure('invalid_input', 'Title is required.')
      if (trimmed.length > 300) return failure('invalid_input', 'Title is too long.')
      data.title = trimmed
    }
    if (input.body !== undefined) {
      if (typeof input.body === 'object' && input.body !== null && 'root' in input.body) {
        data.body = input.body
      } else {
        const trimmed = (input.body as string).trim()
        if (!trimmed) return failure('invalid_input', 'Body is required.')
        if (trimmed.length > 50_000) return failure('invalid_input', 'Body is too long.')
        data.body = {
          root: {
            type: 'root',
            format: '',
            indent: 0,
            version: 1,
            children: trimmed
              .split(/\r?\n/)
              .filter(Boolean)
              .slice(0, 500)
              .map((line: string) => ({
                type: 'paragraph',
                format: '',
                indent: 0,
                version: 1,
                textFormat: 0,
                textStyle: '',
                children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text: line, version: 1 }],
              })),
          },
        }
      }
    }

    if (Object.keys(data).length === 0) return failure('invalid_input', 'Nothing to update.')

    await payload.update({
      collection: 'payload_space_posts',
      id: postId,
      data,
      ...privilegedAccess,
      overrideLock: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'post.edited',
      targetCollection: 'payload_space_posts',
      targetId: postId,
      before: { title: post.title },
      after: data.title ? { title: data.title } : { bodyEdited: true },
    })

    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminEditPostAction')
  }
}

// ---------------------------------------------------------------------------
// Comment moderation
// ---------------------------------------------------------------------------

export async function adminEditCommentAction(
  commentId: string,
  body: string | { root: unknown },
  expectedPostId: string,
  expectedSpaceId: string,
): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')

    const comment = await payload.findByID({
      collection: 'payload_space_comments',
      id: commentId,
      depth: 0,
      ...privilegedAccess,
    })
    if (!comment) return failure('not_found', 'Comment not found.')

    const commentPostId = typeof comment.post === 'object' && comment.post !== null
      ? String((comment.post as Record<string, unknown>).id)
      : String(comment.post)
    if (commentPostId !== expectedPostId) return failure('invalid_input', 'Comment does not belong to the specified post.')

    const post = await payload.findByID({ collection: 'payload_space_posts', id: expectedPostId, depth: 0, ...privilegedAccess })
    if (!post) return failure('not_found', 'Post not found.')
    const postSpaceId = typeof post.space === 'object' && post.space !== null
      ? String((post.space as Record<string, unknown>).id)
      : String(post.space)
    if (postSpaceId !== expectedSpaceId) return failure('invalid_input', 'Post does not belong to the specified space.')

    let richTextBody: unknown
    if (typeof body === 'object' && body !== null && 'root' in body) {
      richTextBody = body
    } else {
      const trimmed = (body as string).trim()
      if (!trimmed) return failure('invalid_input', 'Body is required.')
      if (trimmed.length > 10_000) return failure('invalid_input', 'Body is too long.')
      richTextBody = {
        root: {
          type: 'root',
          format: '',
          indent: 0,
          version: 1,
          children: trimmed
            .split(/\r?\n/)
            .filter(Boolean)
            .slice(0, 100)
            .map((line: string) => ({
              type: 'paragraph',
              format: '',
              indent: 0,
              version: 1,
              textFormat: 0,
              textStyle: '',
              children: [
                {
                  type: 'text',
                  detail: 0,
                  format: 0,
                  mode: 'normal',
                  style: '',
                  text: line,
                  version: 1,
                },
              ],
            })),
        },
      }
    }

    await payload.update({
      collection: 'payload_space_comments',
      id: commentId,
      data: { body: richTextBody },
      ...privilegedAccess,
      overrideLock: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'comment.edited',
      targetCollection: 'payload_space_comments',
      targetId: commentId,
      after: { bodyType: typeof body === 'object' ? 'lexical' : 'text' },
    })

    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminEditCommentAction')
  }
}

export async function adminDeleteCommentAction(
  commentId: string,
  confirmed: boolean,
  expectedPostId: string,
  expectedSpaceId: string,
): Promise<ActionResult> {
  try {
    if (!confirmed) return failure('invalid_input', 'Deletion requires explicit confirmation.')
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')

    const comment = await payload.findByID({
      collection: 'payload_space_comments',
      id: commentId,
      depth: 0,
      ...privilegedAccess,
    })
    if (!comment) return failure('not_found', 'Comment not found.')

    const commentPostId = typeof comment.post === 'object' && comment.post !== null
      ? String((comment.post as Record<string, unknown>).id)
      : String(comment.post)
    if (commentPostId !== expectedPostId) return failure('invalid_input', 'Comment does not belong to the specified post.')

    const post = await payload.findByID({ collection: 'payload_space_posts', id: expectedPostId, depth: 0, ...privilegedAccess })
    if (!post) return failure('not_found', 'Post not found.')
    const postSpaceId = typeof post.space === 'object' && post.space !== null
      ? String((post.space as Record<string, unknown>).id)
      : String(post.space)
    if (postSpaceId !== expectedSpaceId) return failure('invalid_input', 'Post does not belong to the specified space.')

    if (!payload.delete) throw new Error('delete not available on this payload instance')
    await payload.delete({
      collection: 'payload_space_comments',
      id: commentId,
      ...privilegedAccess,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'comment.deleted',
      targetCollection: 'payload_space_comments',
      targetId: commentId,
      before: { displayName: comment.displayName },
    })

    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminDeleteCommentAction')
  }
}

export async function adminHideCommentAction(commentId: string, expectedPostId: string, expectedSpaceId: string): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')

    const comment = await payload.findByID({ collection: 'payload_space_comments', id: commentId, depth: 0, ...privilegedAccess })
    if (!comment) return failure('not_found', 'Comment not found.')
    const commentPostId = typeof comment.post === 'object' && comment.post !== null
      ? String((comment.post as Record<string, unknown>).id)
      : String(comment.post)
    if (commentPostId !== expectedPostId) return failure('invalid_input', 'Comment does not belong to the specified post.')

    const post = await payload.findByID({ collection: 'payload_space_posts', id: expectedPostId, depth: 0, ...privilegedAccess })
    if (!post) return failure('not_found', 'Post not found.')
    const postSpaceId = typeof post.space === 'object' && post.space !== null
      ? String((post.space as Record<string, unknown>).id)
      : String(post.space)
    if (postSpaceId !== expectedSpaceId) return failure('invalid_input', 'Post does not belong to the specified space.')

    await payload.update({
      collection: 'payload_space_comments',
      id: commentId,
      data: { moderationStatus: 'hidden' },
      ...privilegedAccess,
      overrideLock: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'comment.hidden',
      targetCollection: 'payload_space_comments',
      targetId: commentId,
      after: { moderationStatus: 'hidden' },
    })

    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminHideCommentAction')
  }
}

export async function adminUnhideCommentAction(commentId: string, expectedPostId: string, expectedSpaceId: string): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')

    const comment = await payload.findByID({ collection: 'payload_space_comments', id: commentId, depth: 0, ...privilegedAccess })
    if (!comment) return failure('not_found', 'Comment not found.')
    const commentPostId = typeof comment.post === 'object' && comment.post !== null
      ? String((comment.post as Record<string, unknown>).id)
      : String(comment.post)
    if (commentPostId !== expectedPostId) return failure('invalid_input', 'Comment does not belong to the specified post.')

    const post = await payload.findByID({ collection: 'payload_space_posts', id: expectedPostId, depth: 0, ...privilegedAccess })
    if (!post) return failure('not_found', 'Post not found.')
    const postSpaceId = typeof post.space === 'object' && post.space !== null
      ? String((post.space as Record<string, unknown>).id)
      : String(post.space)
    if (postSpaceId !== expectedSpaceId) return failure('invalid_input', 'Post does not belong to the specified space.')

    await payload.update({
      collection: 'payload_space_comments',
      id: commentId,
      data: { moderationStatus: 'visible' },
      ...privilegedAccess,
      overrideLock: true,
    })

    await createAuditEvent(payload, {
      actorType: 'admin',
      actorId: actor.administratorId,
      action: 'comment.unhidden',
      targetCollection: 'payload_space_comments',
      targetId: commentId,
      after: { moderationStatus: 'visible' },
    })

    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminUnhideCommentAction')
  }
}
