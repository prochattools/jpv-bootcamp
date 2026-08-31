import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  applyConsolidationPlanWrites,
  applyConsolidationPlanToSnapshot,
  buildConsolidationPlan,
  consolidationPlanFingerprint,
  planOperationCount,
  sourceDependencyCounts,
  type InfoForumSnapshot,
} from './infoForumConsolidationPlan'

const sourceId = 'space-info'
const destinationId = 'space-forum'

const snapshot: InfoForumSnapshot = {
  spaces: [
    { id: sourceId, slug: 'info-forum', name: 'Info Forum', status: 'published' },
    { id: destinationId, slug: 'forum', name: 'Forum', status: 'published' },
  ],
  posts: [{ id: 'post-1', space: sourceId }],
  memberships: [
    { id: 'membership-1', member: 'member-1', space: sourceId },
    { id: 'membership-2', member: 'member-1', space: destinationId },
    { id: 'membership-4', member: 'member-1', space: destinationId },
    { id: 'membership-3', member: 'member-2', space: sourceId },
  ],
  files: [{ id: 'file-1', space: sourceId }],
  threads: [{ id: 'thread-1', space: sourceId }],
  rooms: [{ id: 'room-1', space: sourceId }],
  policies: [{ id: 'policy-1', resourceType: 'space', resourceId: sourceId }],
  grants: [{ id: 'grant-1', resourceType: 'space', resourceId: sourceId }],
  entitlementEvents: [{ id: 'event-1', resourceType: 'space', resourceId: sourceId }],
  notifications: [
    { id: 'notification-1', href: '/portal/community/info-forum/posts/post-1' },
    { id: 'notification-2', href: '/portal/community/other' },
  ],
  comments: 2,
  reactions: 3,
  chatMessages: 4,
}

const dryRunPlan = buildConsolidationPlan(snapshot, sourceId, destinationId)
assert.equal(dryRunPlan.moves.length, 7, 'all direct space and polymorphic references should be planned')
assert.equal(dryRunPlan.membershipMoves.length, 1)
assert.equal(dryRunPlan.membershipDeletes.length, 2)
assert.deepEqual(dryRunPlan.membershipDeletes.map((operation) => operation.reason), ['duplicate_destination_membership', 'destination_membership_exists'])
assert.equal(dryRunPlan.notificationRewrites.length, 1)
assert.deepEqual(dryRunPlan.conflicts, [])
assert.deepEqual(dryRunPlan.preservedRelationshipCounts, { comments: 2, reactions: 3, chatMessages: 4 })
assert.equal(planOperationCount(dryRunPlan), 11)
assert.equal(snapshot.posts[0].space, sourceId, 'dry-run planning must not mutate its input')
assert.deepEqual(sourceDependencyCounts(applyConsolidationPlanToSnapshot(snapshot, dryRunPlan), sourceId), {
  posts: 0,
  memberships: 0,
  files: 0,
  threads: 0,
  rooms: 0,
  policies: 0,
  grants: 0,
  entitlementEvents: 0,
  notificationDeepLinks: 0,
})

const appliedSnapshot = applyConsolidationPlanToSnapshot(snapshot, dryRunPlan)

const rerunPlan = buildConsolidationPlan(appliedSnapshot, sourceId, destinationId)
assert.equal(planOperationCount(rerunPlan), 0, 'a rerun after apply must be idempotent')
assert.deepEqual(rerunPlan.preservedRelationshipCounts, { comments: 2, reactions: 3, chatMessages: 4 })

const aliasSnapshot: InfoForumSnapshot = structuredClone(snapshot)
aliasSnapshot.spaces[0].slug = 'start-here'
aliasSnapshot.notifications.push(
  { id: 'notification-alias-1', href: '/portal/community/start-here/posts/post-1' },
)
const aliasPlan = buildConsolidationPlan(aliasSnapshot, sourceId, destinationId, 'start-here', 'forum', ['start-here', 'info-forum'])
assert.equal(aliasPlan.notificationRewrites.length, 2, 'known legacy route aliases should both be rewritten')
assert.deepEqual(sourceDependencyCounts(aliasSnapshot, sourceId, 'start-here', ['start-here', 'info-forum']).notificationDeepLinks, 2)
assert.equal(aliasPlan.notificationRewrites.every((operation) => operation.to.startsWith('/portal/community/forum')), true)

function relationValue(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id: string }).id)
  return String(value)
}

function matchesWhere(document: Record<string, unknown>, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) return where.and.every((entry) => matchesWhere(document, entry as Record<string, unknown>))
  if (Array.isArray(where.or)) return where.or.some((entry) => matchesWhere(document, entry as Record<string, unknown>))
  return Object.entries(where).every(([field, condition]) => {
    const value = document[field]
    const rule = condition as Record<string, unknown>
    if (rule.equals !== undefined) return Array.isArray(value) ? value.some((item) => relationValue(item) === String(rule.equals)) : relationValue(value) === String(rule.equals)
    if (Array.isArray(rule.in)) return rule.in.map(String).includes(relationValue(value))
    return true
  })
}

class FakePayload {
  readonly updates: Array<{ collection: string; id: string; data: Record<string, unknown> }> = []
  readonly deletes: Array<{ collection: string; id: string }> = []

  constructor(readonly collections: Record<string, Array<Record<string, unknown>>>) {}

  async find(args: { collection: string; where?: Record<string, unknown> }) {
    return { docs: (this.collections[args.collection] ?? []).filter((document) => matchesWhere(document, args.where)) }
  }

  async update(args: { collection: string; id: string; data: Record<string, unknown> }) {
    const documents = this.collections[args.collection] ?? []
    const document = documents.find((candidate) => String(candidate.id) === String(args.id))
    if (!document) throw new Error('missing update target')
    Object.assign(document, args.data)
    this.updates.push({ collection: args.collection, id: String(args.id), data: args.data })
    return document
  }

  async delete(args: { collection: string; id: string }) {
    const documents = this.collections[args.collection] ?? []
    const index = documents.findIndex((candidate) => String(candidate.id) === String(args.id))
    if (index < 0) throw new Error('missing delete target')
    documents.splice(index, 1)
    this.deletes.push({ collection: args.collection, id: String(args.id) })
  }
}

const runtime = new FakePayload({
  payload_space_posts: [{ id: 'post-1', space: sourceId, body: 'preserve' }],
  payload_space_comments: [{ id: 'comment-1', post: 'post-1', body: 'preserve' }],
  payload_space_reactions: [{ id: 'legacy-reaction-1', targetPost: 'post-1', reactionType: 'like' }],
  payload_engagement_reactions: [{ id: 'engagement-reaction-1', targetSpaceComment: 'comment-1', reactionType: 'helpful' }],
  payload_space_files: [{ id: 'file-1', space: sourceId, post: 'post-1' }],
  payload_space_memberships: [
    { id: 'membership-1', member: 'member-1', space: sourceId },
    { id: 'membership-2', member: 'member-1', space: destinationId },
    { id: 'membership-4', member: 'member-1', space: destinationId },
    { id: 'membership-3', member: 'member-2', space: sourceId },
  ],
  payload_chat_threads: [{ id: 'thread-1', space: sourceId }],
  payload_chat_messages: [{ id: 'message-1', thread: 'thread-1', body: 'preserve' }],
  live_sessions: [{ id: 'room-1', space: sourceId }],
  payload_access_policies: [{ id: 'policy-1', resourceType: 'space', resourceId: sourceId }],
  payload_access_grants: [{ id: 'grant-1', resourceType: 'space', resourceId: sourceId }],
  payload_entitlement_events: [{ id: 'event-1', resourceType: 'space', resourceId: sourceId }],
  payload_member_notifications: [{ id: 'notification-1', href: '/portal/community/info-forum/posts/post-1' }],
  payload_spaces: [
    { id: sourceId, slug: 'info-forum', name: 'Info Forum', status: 'published' },
    { id: destinationId, slug: 'forum', name: 'Forum', status: 'published' },
  ],
})

async function testApply(): Promise<void> {
await applyConsolidationPlanWrites(runtime, dryRunPlan)
await runtime.update({ collection: 'payload_spaces', id: sourceId, data: { status: 'archived' } })
assert.equal(runtime.collections.payload_space_posts[0]?.space, destinationId)
assert.equal(runtime.collections.payload_space_files[0]?.space, destinationId)
assert.equal(runtime.collections.payload_space_comments[0]?.post, 'post-1')
assert.equal(runtime.collections.payload_space_reactions[0]?.targetPost, 'post-1')
assert.equal(runtime.collections.payload_engagement_reactions[0]?.targetSpaceComment, 'comment-1')
assert.equal(runtime.collections.payload_chat_messages[0]?.thread, 'thread-1')
assert.equal(runtime.collections.payload_space_memberships.length, 2)
assert.equal(runtime.collections.payload_space_memberships.some((membership) => membership.member === 'member-2' && membership.space === destinationId), true)
assert.equal(runtime.collections.payload_member_notifications[0]?.href, '/portal/community/forum/posts/post-1')
assert.equal(runtime.collections.payload_spaces[0]?.status, 'archived')
assert.equal(runtime.deletes.length, 2)

const runtimeRerunSnapshot: InfoForumSnapshot = {
  spaces: [
    { id: sourceId, slug: 'info-forum', name: 'Info Forum', status: 'archived' },
    { id: destinationId, slug: 'forum', name: 'Forum', status: 'published' },
  ],
  posts: [{ id: 'post-1', space: destinationId }],
  memberships: [
    { id: 'membership-2', member: 'member-1', space: destinationId },
    { id: 'membership-3', member: 'member-2', space: destinationId },
  ],
  files: [{ id: 'file-1', space: destinationId }],
  threads: [{ id: 'thread-1', space: destinationId }],
  rooms: [{ id: 'room-1', space: destinationId }],
  policies: [{ id: 'policy-1', resourceType: 'space', resourceId: destinationId }],
  grants: [{ id: 'grant-1', resourceType: 'space', resourceId: destinationId }],
  entitlementEvents: [{ id: 'event-1', resourceType: 'space', resourceId: destinationId }],
  notifications: [{ id: 'notification-1', href: '/portal/community/forum/posts/post-1' }],
  comments: 1,
  reactions: 2,
  chatMessages: 1,
}
const actualRerunPlan = buildConsolidationPlan(runtimeRerunSnapshot, sourceId, destinationId)
assert.equal(planOperationCount(actualRerunPlan), 0)
assert.equal(Object.values(sourceDependencyCounts(runtimeRerunSnapshot, sourceId)).every((count) => count === 0), true)
assert.match(consolidationPlanFingerprint(snapshot, dryRunPlan, sourceId, destinationId), /^[0-9a-f]{64}$/)

const communityPageSource = readFileSync(resolve(import.meta.dirname, '../../src/app/(frontend)/portal/community/[spaceSlug]/page.tsx'), 'utf8')
const migrationRunnerSource = readFileSync(resolve(import.meta.dirname, 'consolidateInfoForum.ts'), 'utf8')
assert.match(communityPageSource, /redirect\(.*FORUM_CANONICAL_SLUG/)
assert.match(migrationRunnerSource, /argv\.includes\('--apply'\)/)
assert.match(migrationRunnerSource, /production_apply_disabled_for_info_forum_consolidation/)
}

testApply().then(() => console.log('infoForumConsolidationPlan.test.ts passed')).catch((error) => {
  console.error(error)
  process.exitCode = 1
})
