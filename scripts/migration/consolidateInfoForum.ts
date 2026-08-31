import { getPayload } from 'payload'

import config from '../../src/payload.config'
import { relationshipId } from '../../src/lib/domain/relationships'
import {
  FORUM_CANONICAL_NAME,
  FORUM_CANONICAL_SLUG,
  INFO_FORUM_LEGACY_NAME,
  INFO_FORUM_LEGACY_SLUG,
} from '../../src/lib/community/infoForumMigration'
import {
  buildConsolidationPlan,
  type InfoForumSnapshot,
} from './infoForumConsolidationPlan'

type PayloadClient = Awaited<ReturnType<typeof getPayload>>
type Document = { id: string | number; [key: string]: unknown }

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}

async function findAll(payload: PayloadClient, collection: string, where?: Record<string, unknown>): Promise<Document[]> {
  const docs: Document[] = []
  let page = 1
  do {
    const result = await payload.find({
      collection: collection as never,
      where,
      limit: 200,
      page,
      depth: 0,
      overrideAccess: true,
    })
    docs.push(...(result.docs as Document[]))
    if (!result.hasNextPage || page >= 1000) break
    page += 1
  } while (true)
  return docs
}

async function resolveSpace(
  payload: PayloadClient,
  label: 'source' | 'destination',
  slug: string,
  expectedName: string,
  explicitId?: string,
): Promise<Document> {
  const docs = explicitId
    ? [await payload.findByID({ collection: 'payload_spaces', id: explicitId, depth: 0, overrideAccess: true }) as unknown as Document | null]
    : (await payload.find({
        collection: 'payload_spaces',
        where: { slug: { equals: slug } },
        limit: 10,
        depth: 0,
        overrideAccess: true,
      })).docs as unknown as Document[]
  const matches = docs.filter((doc): doc is Document => Boolean(doc))
  if (matches.length !== 1) throw new Error(`${label}_space_identity_not_unique`)
  const space = matches[0]
  if (String(space.slug) !== slug || String(space.name).trim() !== expectedName) {
    throw new Error(`${label}_space_identity_mismatch`)
  }
  return space
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map(relationshipId).filter((id): id is string => Boolean(id))
}

async function buildSnapshot(payload: PayloadClient, sourceId: string, destinationId: string): Promise<InfoForumSnapshot> {
  const [posts, memberships, files, threads, rooms, policies, grants, entitlementEvents, notifications] = await Promise.all([
    findAll(payload, 'payload_space_posts', { space: { equals: sourceId } }),
    findAll(payload, 'payload_space_memberships', { space: { in: [sourceId, destinationId] } }),
    findAll(payload, 'payload_space_files', { space: { equals: sourceId } }),
    findAll(payload, 'payload_chat_threads', { space: { equals: sourceId } }),
    findAll(payload, 'live_sessions', { space: { equals: sourceId } }),
    findAll(payload, 'payload_access_policies', { and: [{ resourceType: { equals: 'space' } }, { resourceId: { equals: sourceId } }] }),
    findAll(payload, 'payload_access_grants', { and: [{ resourceType: { equals: 'space' } }, { resourceId: { equals: sourceId } }] }),
    findAll(payload, 'payload_entitlement_events', { and: [{ resourceType: { equals: 'space' } }, { resourceId: { equals: sourceId } }] }),
    findAll(payload, 'payload_member_notifications'),
  ])
  const postIds = posts.map((post) => String(post.id))
  const threadIds = threads.map((thread) => String(thread.id))
  const [comments, chatMessages] = await Promise.all([
    postIds.length ? findAll(payload, 'payload_space_comments', { post: { in: postIds } }) : [],
    threadIds.length ? findAll(payload, 'payload_chat_messages', { thread: { in: threadIds } }) : [],
  ])
  const commentIds = comments.map((comment) => String(comment.id))
  const [legacyReactions, engagementReactions] = postIds.length || commentIds.length
    ? await Promise.all([
        findAll(payload, 'payload_space_reactions', { or: [{ targetPost: { in: postIds } }, { targetComment: { in: commentIds } }] }),
        findAll(payload, 'payload_engagement_reactions', { or: [{ targetPost: { in: postIds } }, { targetSpaceComment: { in: commentIds } }] }),
      ])
    : [[], []]
  return {
    posts: posts.map((doc) => ({ id: String(doc.id), space: relationshipId(doc.space) ?? sourceId })),
    memberships: memberships.map((doc) => ({ id: String(doc.id), member: relationshipId(doc.member) ?? '', space: relationshipId(doc.space) ?? sourceId })),
    files: files.map((doc) => ({ id: String(doc.id), space: relationshipId(doc.space) ?? sourceId })),
    threads: threads.map((doc) => ({ id: String(doc.id), space: relationshipId(doc.space) ?? sourceId })),
    rooms: rooms.map((doc) => ({ id: String(doc.id), space: relationshipId(doc.space) ?? sourceId })),
    policies: policies.map((doc) => ({ id: String(doc.id), resourceType: String(doc.resourceType), resourceId: String(doc.resourceId) })),
    grants: grants.map((doc) => ({ id: String(doc.id), resourceType: String(doc.resourceType), resourceId: String(doc.resourceId) })),
    entitlementEvents: entitlementEvents.map((doc) => ({ id: String(doc.id), resourceType: String(doc.resourceType), resourceId: String(doc.resourceId) })),
    notifications: notifications
      .map((doc) => ({ id: String(doc.id), href: typeof doc.href === 'string' ? doc.href : '' }))
      .filter((doc) => doc.href.length > 0),
    comments: comments.length,
    reactions: legacyReactions.length + engagementReactions.length,
    chatMessages: chatMessages.length,
  }
}

function summary(plan: ReturnType<typeof buildConsolidationPlan>, snapshot: InfoForumSnapshot, source: Document, destination: Document, mode: 'dry-run' | 'apply') {
  const byCollection = plan.moves.reduce<Record<string, number>>((counts, operation) => {
    counts[operation.collection] = (counts[operation.collection] ?? 0) + 1
    return counts
  }, {})
  return {
    mode,
    source: { id: String(source.id), slug: String(source.slug) },
    destination: { id: String(destination.id), slug: String(destination.slug) },
    inventory: {
      sourcePosts: snapshot.posts.filter((item) => item.space === String(source.id)).length,
      sourceMemberships: snapshot.memberships.filter((item) => item.space === String(source.id)).length,
      destinationMemberships: snapshot.memberships.filter((item) => item.space === String(destination.id)).length,
      sourceFiles: snapshot.files.filter((item) => item.space === String(source.id)).length,
      sourceChatThreads: snapshot.threads.filter((item) => item.space === String(source.id)).length,
      sourceRooms: snapshot.rooms.filter((item) => item.space === String(source.id)).length,
      sourceAccessPolicies: snapshot.policies.filter((item) => item.resourceType === 'space' && item.resourceId === String(source.id)).length,
      sourceAccessGrants: snapshot.grants.filter((item) => item.resourceType === 'space' && item.resourceId === String(source.id)).length,
      sourceEntitlementEvents: snapshot.entitlementEvents.filter((item) => item.resourceType === 'space' && item.resourceId === String(source.id)).length,
      indirectComments: snapshot.comments,
      indirectReactions: snapshot.reactions,
      indirectChatMessages: snapshot.chatMessages,
      notificationDeepLinks: plan.notificationRewrites.length,
    },
    planned: {
      totalOperations: plan.moves.length + plan.membershipMoves.length + plan.membershipDeletes.length + plan.notificationRewrites.length,
      directMovesByCollection: byCollection,
      membershipMoves: plan.membershipMoves.length,
      membershipDeduplications: plan.membershipDeletes.length,
      notificationRewrites: plan.notificationRewrites.length,
    },
    preservedRelationships: plan.preservedRelationshipCounts,
    productionApply: false,
  }
}

async function applyPlan(payload: PayloadClient, plan: ReturnType<typeof buildConsolidationPlan>, source: Document): Promise<void> {
  for (const operation of plan.moves) {
    await (payload as any).update({ collection: operation.collection as never, id: operation.id, data: { [operation.field]: operation.to }, overrideAccess: true, overrideLock: true })
  }
  for (const operation of plan.membershipMoves) {
    await (payload as any).update({ collection: 'payload_space_memberships', id: operation.id, data: { space: operation.to }, overrideAccess: true, overrideLock: true })
  }
  if (!payload.delete && plan.membershipDeletes.length > 0) throw new Error('membership_deduplication_delete_unavailable')
  for (const operation of plan.membershipDeletes) {
    await (payload as any).delete!({ collection: 'payload_space_memberships', id: operation.id, overrideAccess: true })
  }
  for (const operation of plan.notificationRewrites) {
    await (payload as any).update({ collection: 'payload_member_notifications', id: operation.id, data: { href: operation.to }, overrideAccess: true, overrideLock: true })
  }
  await (payload as any).update({ collection: 'payload_spaces', id: source.id, data: { status: 'archived' }, overrideAccess: true, overrideLock: true })
}

export async function runInfoForumConsolidation(argv = process.argv.slice(2)): Promise<void> {
  const apply = argv.includes('--apply')
  const sourceId = flagValue(argv, '--source-id')
  const destinationId = flagValue(argv, '--destination-id')
  const payload = await getPayload({ config })
  const source = await resolveSpace(payload, 'source', INFO_FORUM_LEGACY_SLUG, INFO_FORUM_LEGACY_NAME, sourceId)
  const destination = await resolveSpace(payload, 'destination', FORUM_CANONICAL_SLUG, FORUM_CANONICAL_NAME, destinationId)
  if (String(source.id) === String(destination.id)) throw new Error('source_and_destination_must_differ')
  const snapshot = await buildSnapshot(payload, String(source.id), String(destination.id))
  const plan = buildConsolidationPlan(snapshot, String(source.id), String(destination.id), INFO_FORUM_LEGACY_SLUG, FORUM_CANONICAL_SLUG)
  console.log(JSON.stringify(summary(plan, snapshot, source, destination, apply ? 'apply' : 'dry-run'), null, 2))
  if (!apply) return
  if (process.env.NODE_ENV === 'production' || process.env.APP_ENV === 'production' || process.env.DEPLOYMENT_ENV === 'production') {
    throw new Error('production_apply_disabled_for_info_forum_consolidation')
  }
  await applyPlan(payload, plan, source)
  console.log(JSON.stringify({ applied: true, sourceArchived: true, rerunIsIdempotent: true }))
}

if (import.meta.url === new URL(`file://${process.argv[1] ?? ''}`).href) {
  runInfoForumConsolidation().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
