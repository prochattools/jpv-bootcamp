export type SpaceRef = { id: string; space: string }
export type MembershipRef = { id: string; member: string; space: string }
export type ResourceRef = { id: string; resourceType: string; resourceId: string }
export type NotificationRef = { id: string; href: string }

export type InfoForumSnapshot = {
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
}

export type ConsolidationPlan = {
  moves: Array<{ collection: string; id: string; field: 'space' | 'resourceId'; from: string; to: string }>
  membershipMoves: Array<{ id: string; from: string; to: string }>
  membershipDeletes: Array<{ id: string; reason: 'destination_membership_exists' }>
  notificationRewrites: Array<{ id: string; from: string; to: string }>
  preservedRelationshipCounts: {
    comments: number
    reactions: number
    chatMessages: number
  }
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
): ConsolidationPlan {
  const destinationMembers = new Set(
    snapshot.memberships
      .filter((membership) => membership.space === destinationId)
      .map((membership) => membership.member),
  )
  const membershipMoves: ConsolidationPlan['membershipMoves'] = []
  const membershipDeletes: ConsolidationPlan['membershipDeletes'] = []
  for (const membership of snapshot.memberships.filter((item) => item.space === sourceId)) {
    if (destinationMembers.has(membership.member)) {
      membershipDeletes.push({ id: membership.id, reason: 'destination_membership_exists' })
    } else {
      membershipMoves.push({ id: membership.id, from: sourceId, to: destinationId })
      destinationMembers.add(membership.member)
    }
  }

  const oldPrefix = `/portal/community/${sourceSlug}`
  const newPrefix = `/portal/community/${destinationSlug}`
  const notificationRewrites = snapshot.notifications
    .filter((notification) => notification.href === oldPrefix || notification.href.startsWith(`${oldPrefix}/`))
    .map((notification) => ({
      id: notification.id,
      from: notification.href,
      to: `${newPrefix}${notification.href.slice(oldPrefix.length)}`,
    }))

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
