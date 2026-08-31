import assert from 'node:assert/strict'

import { buildConsolidationPlan, planOperationCount, type InfoForumSnapshot } from './infoForumConsolidationPlan'

const sourceId = 'space-info'
const destinationId = 'space-forum'

const snapshot: InfoForumSnapshot = {
  posts: [{ id: 'post-1', space: sourceId }],
  memberships: [
    { id: 'membership-1', member: 'member-1', space: sourceId },
    { id: 'membership-2', member: 'member-1', space: destinationId },
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
assert.equal(dryRunPlan.membershipDeletes.length, 1)
assert.equal(dryRunPlan.notificationRewrites.length, 1)
assert.deepEqual(dryRunPlan.preservedRelationshipCounts, { comments: 2, reactions: 3, chatMessages: 4 })
assert.equal(planOperationCount(dryRunPlan), 10)
assert.equal(snapshot.posts[0].space, sourceId, 'dry-run planning must not mutate its input')

const appliedSnapshot: InfoForumSnapshot = structuredClone(snapshot)
for (const ref of appliedSnapshot.posts) if (ref.space === sourceId) ref.space = destinationId
for (const ref of appliedSnapshot.files) if (ref.space === sourceId) ref.space = destinationId
for (const ref of appliedSnapshot.threads) if (ref.space === sourceId) ref.space = destinationId
for (const ref of appliedSnapshot.rooms) if (ref.space === sourceId) ref.space = destinationId
for (const ref of appliedSnapshot.policies) if (ref.resourceId === sourceId) ref.resourceId = destinationId
for (const ref of appliedSnapshot.grants) if (ref.resourceId === sourceId) ref.resourceId = destinationId
for (const ref of appliedSnapshot.entitlementEvents) if (ref.resourceId === sourceId) ref.resourceId = destinationId
appliedSnapshot.memberships = appliedSnapshot.memberships.filter((ref) => ref.id !== 'membership-1')
for (const ref of appliedSnapshot.memberships) if (ref.space === sourceId) ref.space = destinationId
for (const ref of appliedSnapshot.notifications) ref.href = ref.href.replace('/portal/community/info-forum', '/portal/community/forum')

const rerunPlan = buildConsolidationPlan(appliedSnapshot, sourceId, destinationId)
assert.equal(planOperationCount(rerunPlan), 0, 'a rerun after apply must be idempotent')
assert.deepEqual(rerunPlan.preservedRelationshipCounts, { comments: 2, reactions: 3, chatMessages: 4 })

console.log('infoForumConsolidationPlan.test.ts passed')
