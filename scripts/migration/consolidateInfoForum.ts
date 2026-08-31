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
  applyConsolidationPlanToSnapshot,
  applyConsolidationPlanWrites,
  buildConsolidationPlan,
  sourceDependencyCounts,
  totalSourceDependencyCount,
  type InfoForumSnapshot,
} from './infoForumConsolidationPlan'

type PayloadClient = Awaited<ReturnType<typeof getPayload>>
type Document = { id: string | number; [key: string]: unknown }

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag)
  if (index < 0) return undefined
  const value = args[index + 1]
  if (!value || value.startsWith('--')) throw new Error(flag + '_requires_value')
  return value
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
    if (!result.hasNextPage) break
    if (page >= 1000) throw new Error(collection + '_pagination_limit_exceeded')
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
    findAll(payload, 'payload_space_posts', { space: { in: [sourceId, destinationId] } }),
    findAll(payload, 'payload_space_memberships', { space: { in: [sourceId, destinationId] } }),
    findAll(payload, 'payload_space_files', { space: { in: [sourceId, destinationId] } }),
    findAll(payload, 'payload_chat_threads', { space: { in: [sourceId, destinationId] } }),
    findAll(payload, 'live_sessions', { space: { in: [sourceId, destinationId] } }),
    findAll(payload, 'payload_access_policies', { and: [{ resourceType: { equals: 'space' } }, { resourceId: { in: [sourceId, destinationId] } }] }),
    findAll(payload, 'payload_access_grants', { and: [{ resourceType: { equals: 'space' } }, { resourceId: { in: [sourceId, destinationId] } }] }),
    findAll(payload, 'payload_entitlement_events', { and: [{ resourceType: { equals: 'space' } }, { resourceId: { in: [sourceId, destinationId] } }] }),
    findAll(payload, 'payload_member_notifications'),
  ])
  const sourcePostIds = posts.filter((post) => relationshipId(post.space) === sourceId).map((post) => String(post.id))
  const sourceThreadIds = threads.filter((thread) => relationshipId(thread.space) === sourceId).map((thread) => String(thread.id))
  const [comments, chatMessages] = await Promise.all([
    sourcePostIds.length ? findAll(payload, 'payload_space_comments', { post: { in: sourcePostIds } }) : [],
    sourceThreadIds.length ? findAll(payload, 'payload_chat_messages', { thread: { in: sourceThreadIds } }) : [],
  ])
  const commentIds = comments.map((comment) => String(comment.id))
  const [legacyReactions, engagementReactions] = sourcePostIds.length || commentIds.length
    ? await Promise.all([
        findAll(payload, 'payload_space_reactions', { or: [{ targetPost: { in: sourcePostIds } }, { targetComment: { in: commentIds } }] }),
        findAll(payload, 'payload_engagement_reactions', { or: [{ targetPost: { in: sourcePostIds } }, { targetSpaceComment: { in: commentIds } }] }),
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
  const simulatedSnapshot = applyConsolidationPlanToSnapshot(snapshot, plan)
  const simulatedRemaining = sourceDependencyCounts(simulatedSnapshot, String(source.id), INFO_FORUM_LEGACY_SLUG)
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
      conflicts: plan.conflicts,
    },
    remainingDependenciesAfterSimulation: simulatedRemaining,
    preservedRelationships: plan.preservedRelationshipCounts,
    productionApply: false,
  }
}

export async function applyInfoForumConsolidationPlan(
  payload: PayloadClient,
  plan: ReturnType<typeof buildConsolidationPlan>,
  source: Document,
  sourceId: string,
  destinationId: string,
): Promise<{ remainingDependencies: ReturnType<typeof sourceDependencyCounts>; destinationCounts: Record<string, number> }> {
  if (plan.conflicts.length > 0) throw new Error('migration_conflicts:' + plan.conflicts.join(','))
  await applyConsolidationPlanWrites(payload as any, plan)
  const verifiedSnapshot = await buildSnapshot(payload, sourceId, destinationId)
  const remaining = sourceDependencyCounts(verifiedSnapshot, sourceId, INFO_FORUM_LEGACY_SLUG)
  if (totalSourceDependencyCount(remaining) > 0) {
    throw new Error('source_dependencies_remain:' + JSON.stringify(remaining))
  }
  const destinationCounts = {
    posts: verifiedSnapshot.posts.filter((item) => item.space === destinationId).length,
    memberships: verifiedSnapshot.memberships.filter((item) => item.space === destinationId).length,
    files: verifiedSnapshot.files.filter((item) => item.space === destinationId).length,
    threads: verifiedSnapshot.threads.filter((item) => item.space === destinationId).length,
    rooms: verifiedSnapshot.rooms.filter((item) => item.space === destinationId).length,
    policies: verifiedSnapshot.policies.filter((item) => item.resourceType === 'space' && item.resourceId === destinationId).length,
    grants: verifiedSnapshot.grants.filter((item) => item.resourceType === 'space' && item.resourceId === destinationId).length,
    entitlementEvents: verifiedSnapshot.entitlementEvents.filter((item) => item.resourceType === 'space' && item.resourceId === destinationId).length,
  }
  await (payload as any).update({ collection: 'payload_spaces', id: source.id, data: { status: 'archived' }, overrideAccess: true, overrideLock: true })
  return { remainingDependencies: remaining, destinationCounts }
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
  const verification = await applyInfoForumConsolidationPlan(payload, plan, source, String(source.id), String(destination.id))
  console.log(JSON.stringify({ applied: true, sourceArchived: true, ...verification, rerunIsIdempotent: true }))
}

if (import.meta.url === new URL(`file://${process.argv[1] ?? ''}`).href) {
  runInfoForumConsolidation().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
