import { createHash } from 'node:crypto'

export type SpaceRef = { id: string; space: string }
export type SpaceIdentity = { id: string; slug: string; name: string; status: string }
export type MembershipRef = { id: string; member: string; space: string }
export type ResourceRef = { id: string; resourceType: string; resourceId: string }
export type NotificationRef = { id: string; href: string }

export type InfoForumSnapshot = {
  spaces: SpaceIdentity[]
  posts: SpaceRef[]
  memberships: MembershipRef[]
  files: SpaceRef[]
  threads: SpaceRef[]
  rooms: SpaceRef[]
  policies: ResourceRef[]
  grants: ResourceRef[]
  entitlementEvents: ResourceRef[]
  notifications: NotificationRef[]
  comments: number
  reactions: number
  chatMessages: number
  relationshipIds?: {
    comments: string[]
    reactions: string[]
    chatMessages: string[]
  }
}

export type ConsolidationPlan = {
  moves: Array<{ collection: string; id: string; field: 'space' | 'resourceId'; from: string; to: string }>
  membershipMoves: Array<{ id: string; from: string; to: string }>
  membershipDeletes: Array<{ id: string; reason: 'destination_membership_exists' | 'duplicate_destination_membership' }>
  notificationRewrites: Array<{ id: string; from: string; to: string }>
  conflicts: string[]
  preservedRelationshipCounts: {
    comments: number
    reactions: number
    chatMessages: number
  }
}

export type SourceDependencyCounts = {
  posts: number
  memberships: number
  files: number
  threads: number
  rooms: number
  policies: number
  grants: number
  entitlementEvents: number
  notificationDeepLinks: number
}

export type ConsolidationWriteAPI = {
  update(args: {
    collection: string
    id: string
    data: Record<string, unknown>
    overrideAccess?: boolean
    overrideLock?: boolean
  }): Promise<unknown>
  delete?: (args: {
    collection: string
    id: string
    overrideAccess?: boolean
  }) => Promise<unknown>
}

function directMoves(collection: string, refs: SpaceRef[], sourceId: string, destinationId: string) {
  return refs
    .filter((ref) => ref.space === sourceId)
    .map((ref) => ({ collection, id: ref.id, field: 'space' as const, from: sourceId, to: destinationId }))
}

function resourceMoves(collection: string, refs: ResourceRef[], sourceId: string, destinationId: string) {
  return refs
    .filter((ref) => ref.resourceType === 'space' && ref.resourceId === sourceId)
    .map((ref) => ({ collection, id: ref.id, field: 'resourceId' as const, from: sourceId, to: destinationId }))
}

export function buildConsolidationPlan(
  snapshot: InfoForumSnapshot,
  sourceId: string,
  destinationId: string,
  sourceSlug = 'info-forum',
  destinationSlug = 'forum',
  sourceRouteSlugs: readonly string[] = [sourceSlug],
): ConsolidationPlan {
  const destinationMembers = new Set<string>()
  const membershipMoves: ConsolidationPlan['membershipMoves'] = []
  const membershipDeletes: ConsolidationPlan['membershipDeletes'] = []
  const conflicts: string[] = []
  for (const membership of snapshot.memberships.filter((item) => item.space === destinationId)) {
    if (!membership.member) {
      conflicts.push('membership:' + membership.id + ':missing-member')
      continue
    }
    if (destinationMembers.has(membership.member)) {
      membershipDeletes.push({ id: membership.id, reason: 'duplicate_destination_membership' })
      continue
    }
    destinationMembers.add(membership.member)
  }
  for (const membership of snapshot.memberships.filter((item) => item.space === sourceId)) {
    if (!membership.member) {
      conflicts.push('membership:' + membership.id + ':missing-member')
      continue
    }
    if (destinationMembers.has(membership.member)) {
      membershipDeletes.push({ id: membership.id, reason: 'destination_membership_exists' })
    } else {
      membershipMoves.push({ id: membership.id, from: sourceId, to: destinationId })
      destinationMembers.add(membership.member)
    }
  }

  const newPrefix = `/portal/community/${destinationSlug}`
  const notificationRewrites = snapshot.notifications
    .flatMap((notification) => {
      const oldPrefix = sourceRouteSlugs
        .map((slug) => `/portal/community/${slug}`)
        .find((prefix) => notification.href === prefix || notification.href.startsWith(`${prefix}/`))
      return oldPrefix
        ? [{ id: notification.id, from: notification.href, to: `${newPrefix}${notification.href.slice(oldPrefix.length)}` }]
        : []
    })

  return {
    moves: [
      ...directMoves('payload_space_posts', snapshot.posts, sourceId, destinationId),
      ...directMoves('payload_space_files', snapshot.files, sourceId, destinationId),
      ...directMoves('payload_chat_threads', snapshot.threads, sourceId, destinationId),
      ...directMoves('live_sessions', snapshot.rooms, sourceId, destinationId),
      ...resourceMoves('payload_access_policies', snapshot.policies, sourceId, destinationId),
      ...resourceMoves('payload_access_grants', snapshot.grants, sourceId, destinationId),
      ...resourceMoves('payload_entitlement_events', snapshot.entitlementEvents, sourceId, destinationId),
    ],
    membershipMoves,
    membershipDeletes,
    notificationRewrites,
    conflicts,
    preservedRelationshipCounts: {
      comments: snapshot.comments,
      reactions: snapshot.reactions,
      chatMessages: snapshot.chatMessages,
    },
  }
}

export function planOperationCount(plan: ConsolidationPlan): number {
  return plan.moves.length + plan.membershipMoves.length + plan.membershipDeletes.length + plan.notificationRewrites.length
}

export async function applyConsolidationPlanWrites(
  writer: ConsolidationWriteAPI,
  plan: ConsolidationPlan,
): Promise<void> {
  for (const operation of plan.moves) {
    await writer.update({
      collection: operation.collection,
      id: operation.id,
      data: { [operation.field]: operation.to },
      overrideAccess: true,
      overrideLock: true,
    })
  }
  for (const operation of plan.membershipMoves) {
    await writer.update({
      collection: 'payload_space_memberships',
      id: operation.id,
      data: { space: operation.to },
      overrideAccess: true,
      overrideLock: true,
    })
  }
  if (!writer.delete && plan.membershipDeletes.length > 0) throw new Error('membership_deduplication_delete_unavailable')
  for (const operation of plan.membershipDeletes) {
    await writer.delete?.({
      collection: 'payload_space_memberships',
      id: operation.id,
      overrideAccess: true,
    })
  }
  for (const operation of plan.notificationRewrites) {
    await writer.update({
      collection: 'payload_member_notifications',
      id: operation.id,
      data: { href: operation.to },
      overrideAccess: true,
      overrideLock: true,
    })
  }
}

export function applyConsolidationPlanToSnapshot(
  snapshot: InfoForumSnapshot,
  plan: ConsolidationPlan,
): InfoForumSnapshot {
  const next = structuredClone(snapshot) as InfoForumSnapshot
  for (const operation of plan.moves) {
    const collection = operation.collection === 'payload_space_posts'
      ? next.posts
      : operation.collection === 'payload_space_files'
        ? next.files
        : operation.collection === 'payload_chat_threads'
          ? next.threads
          : operation.collection === 'live_sessions'
            ? next.rooms
            : operation.collection === 'payload_access_policies'
              ? next.policies
              : operation.collection === 'payload_access_grants'
                ? next.grants
                : next.entitlementEvents
    const reference = collection.find((item) => item.id === operation.id)
    if (!reference) continue
    if ('space' in reference) reference.space = operation.to
    if ('resourceId' in reference) reference.resourceId = operation.to
  }
  for (const operation of plan.membershipDeletes) {
    next.memberships = next.memberships.filter((membership) => membership.id !== operation.id)
  }
  for (const operation of plan.membershipMoves) {
    const membership = next.memberships.find((item) => item.id === operation.id)
    if (membership) membership.space = operation.to
  }
  for (const operation of plan.notificationRewrites) {
    const notification = next.notifications.find((item) => item.id === operation.id)
    if (notification) notification.href = operation.to
  }
  return next
}

export function sourceDependencyCounts(
  snapshot: InfoForumSnapshot,
  sourceId: string,
  sourceSlug = 'info-forum',
  sourceRouteSlugs: readonly string[] = [sourceSlug],
): SourceDependencyCounts {
  const oldPrefixes = sourceRouteSlugs.map((slug) => '/portal/community/' + slug)
  return {
    posts: snapshot.posts.filter((item) => item.space === sourceId).length,
    memberships: snapshot.memberships.filter((item) => item.space === sourceId).length,
    files: snapshot.files.filter((item) => item.space === sourceId).length,
    threads: snapshot.threads.filter((item) => item.space === sourceId).length,
    rooms: snapshot.rooms.filter((item) => item.space === sourceId).length,
    policies: snapshot.policies.filter((item) => item.resourceType === 'space' && item.resourceId === sourceId).length,
    grants: snapshot.grants.filter((item) => item.resourceType === 'space' && item.resourceId === sourceId).length,
    entitlementEvents: snapshot.entitlementEvents.filter((item) => item.resourceType === 'space' && item.resourceId === sourceId).length,
    notificationDeepLinks: snapshot.notifications.filter((item) => oldPrefixes.some((prefix) => item.href === prefix || item.href.startsWith(prefix + '/'))).length,
  }
}

export function totalSourceDependencyCount(counts: SourceDependencyCounts): number {
  return Object.values(counts).reduce((total, count) => total + count, 0)
}

/**
 * Stable, non-PII fingerprint for proving that a later guarded apply is
 * operating on the same target plan and inventory as the approved dry-run.
 */
export function consolidationPlanFingerprint(
  snapshot: InfoForumSnapshot,
  plan: ConsolidationPlan,
  sourceId: string,
  destinationId: string,
): string {
  return createHash('sha256')
    .update(JSON.stringify({ snapshot, plan, sourceId, destinationId }))
    .digest('hex')
}
