'use server'

import { revalidatePath } from 'next/cache'

import { requirePortalAdmin } from '@/lib/auth/requirePortalAdmin'
import {
  failure,
  normalizePortalAdminError,
  success,
  type PortalAdminActionResult,
} from '@/lib/portalAdmin/actionResult'
import { uniqueSlugForName } from '@/lib/domain/slugs'
import { normalizeSlug } from '@/lib/domain/validation'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import {
  editCommunityCommentCommand,
  editCommunityPostCommand,
  deleteCommunityCommentCommand,
  deleteCommunityPostCommand,
  moderateCommunityCommentCommand,
  moderateCommunityPostCommand,
  type CommunityCommandContext,
} from '@/lib/community/commands'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult = PortalAdminActionResult<{ id?: string }>

type SpaceInput = {
  name: string
  slug?: string
  description?: string
  status?: 'draft' | 'published' | 'archived'
  visibility?: 'public' | 'members' | 'private' | 'secret'
}
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
    // Legacy callers may still provide a slug, but normal portal forms omit it
    // and use the deterministic name-based generator.
    const slug = input.slug?.trim()
      ? normalizeSlug(input.slug)
      : await uniqueSlugForName(payload, 'payload_spaces', name)

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
    // Slugs are stable routing identifiers. A space rename keeps the existing
    // slug so historical links and notification deep links remain valid.
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

function adminCommunityContext(
  payload: CommunityCommandContext['payload'],
  actor: CommunityCommandContext['actor'],
  privilegedAccess: CommunityCommandContext['access'],
): CommunityCommandContext {
  return { payload, actor, access: privilegedAccess }
}

export async function adminPinPostAction(postId: string, expectedSpaceId: string): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')
    await moderateCommunityPostCommand(
      adminCommunityContext(payload, actor, privilegedAccess),
      { postId, expectedSpaceId, operation: 'pin' },
    )
    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminPinPostAction')
  }
}

export async function adminUnpinPostAction(postId: string, expectedSpaceId: string): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')
    await moderateCommunityPostCommand(
      adminCommunityContext(payload, actor, privilegedAccess),
      { postId, expectedSpaceId, operation: 'unpin' },
    )
    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminUnpinPostAction')
  }
}

export async function adminLockPostAction(postId: string, expectedSpaceId: string): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')
    await moderateCommunityPostCommand(
      adminCommunityContext(payload, actor, privilegedAccess),
      { postId, expectedSpaceId, operation: 'lock' },
    )
    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminLockPostAction')
  }
}

export async function adminUnlockPostAction(postId: string, expectedSpaceId: string): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')
    await moderateCommunityPostCommand(
      adminCommunityContext(payload, actor, privilegedAccess),
      { postId, expectedSpaceId, operation: 'unlock' },
    )
    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminUnlockPostAction')
  }
}

export async function adminHidePostAction(postId: string, expectedSpaceId: string): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')
    await moderateCommunityPostCommand(
      adminCommunityContext(payload, actor, privilegedAccess),
      { postId, expectedSpaceId, operation: 'hide' },
    )
    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminHidePostAction')
  }
}

export async function adminUnhidePostAction(postId: string, expectedSpaceId: string): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')
    await moderateCommunityPostCommand(
      adminCommunityContext(payload, actor, privilegedAccess),
      { postId, expectedSpaceId, operation: 'unhide' },
    )
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
    await deleteCommunityPostCommand(
      adminCommunityContext(payload, actor, privilegedAccess),
      { postId, expectedSpaceId },
    )
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
    await editCommunityPostCommand(
      adminCommunityContext(payload, actor, privilegedAccess),
      { postId, expectedSpaceId, ...input },
    )
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
    await editCommunityCommentCommand(
      adminCommunityContext(payload, actor, privilegedAccess),
      { commentId, body, expectedPostId, expectedSpaceId },
    )
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
    await deleteCommunityCommentCommand(
      adminCommunityContext(payload, actor, privilegedAccess),
      { commentId, expectedPostId, expectedSpaceId },
    )
    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminDeleteCommentAction')
  }
}

export async function adminHideCommentAction(
  commentId: string,
  expectedPostId: string,
  expectedSpaceId: string,
): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')
    await moderateCommunityCommentCommand(
      adminCommunityContext(payload, actor, privilegedAccess),
      { commentId, expectedPostId, expectedSpaceId, hidden: true },
    )
    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminHideCommentAction')
  }
}

export async function adminUnhideCommentAction(
  commentId: string,
  expectedPostId: string,
  expectedSpaceId: string,
): Promise<ActionResult> {
  try {
    const { actor, payload, privilegedAccess } = await requirePortalAdmin('/portal')
    await moderateCommunityCommentCommand(
      adminCommunityContext(payload, actor, privilegedAccess),
      { commentId, expectedPostId, expectedSpaceId, hidden: false },
    )
    revalidatePath('/portal/community')
    return success({})
  } catch (err) {
    return normalizePortalAdminError(err, 'adminUnhideCommentAction')
  }
}
