import type { PayloadCourseAccessAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'

export type MembershipReadModel = {
  administrators: {
    total: number
    linkedToPortal: number
    unlinked: number
  }
  members: {
    active: number
    activeProfiles: number
    activeWithoutProfile: number
    pending: number
    blocked: number
    suspended: number
  }
  subscriptions: {
    activeRecords: number
    subscribedMembers: number
    totalRecords: number
  }
  reviewQueue: number
  stripe: {
    activeRecords: number | null
    totalRecords: number | null
  }
}

function relationshipId(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return null
}

async function findAll(
  payload: PayloadCourseAccessAPI,
  collection: string,
  where?: Record<string, unknown>,
): Promise<PayloadDocument[]> {
  const docs: PayloadDocument[] = []
  let page = 1
  do {
    const result = await payload.find({
      collection,
      where,
      limit: 100,
      page,
      depth: 0,
      overrideAccess: true,
    })
    docs.push(...(result.docs as PayloadDocument[]))
    if (!result.hasNextPage) break
    page += 1
    if (page > 1000) throw new Error(`membership_read_model_${collection}_page_limit_exceeded`)
  } while (true)
  return docs
}

export type StripeMembershipSnapshot = {
  status: string
  customerId: string | null
}[]

/**
 * Shared membership projection for the Payload dashboard, portal directory,
 * and Stripe reconciliation. Stripe values are supplied by the reconciler;
 * the dashboard remains read-only and reports the current Payload projection.
 */
export async function getMembershipReadModel(
  payload: PayloadCourseAccessAPI,
  stripeSnapshot?: StripeMembershipSnapshot,
): Promise<MembershipReadModel> {
  const [administrators, members, profiles, subscriptions, reviewQueue] = await Promise.all([
    findAll(payload, 'payload_users'),
    findAll(payload, 'payload_members'),
    findAll(payload, 'payload_member_profiles'),
    findAll(payload, 'payload_subscriptions'),
    findAll(payload, 'payload_membership_review_queue_items', { queueState: { equals: 'needs_review' } }),
  ])

  const administratorMemberIds = new Set(
    administrators
      .map((admin) => relationshipId(admin.portalMember))
      .filter((id): id is string => Boolean(id)),
  )
  const activeMembers = members.filter((member) => member.accountStatus === 'active' && !member.isAdministrator)
  const activeMemberIds = new Set(activeMembers.map((member) => String(member.id)))
  const activeProfileMemberIds = new Set(
    profiles
      .map((profile) => relationshipId(profile.member))
      .filter((id): id is string => activeMemberIds.has(id)),
  )
  const activeSubscriptionRecords = subscriptions.filter((subscription) =>
    subscription.status === 'active' || subscription.status === 'trialing',
  )
  const subscribedMemberIds = new Set(
    activeSubscriptionRecords
      .map((subscription) => relationshipId(subscription.member))
      .filter((id): id is string => Boolean(id)),
  )

  return {
    administrators: {
      total: administrators.length,
      linkedToPortal: administratorMemberIds.size,
      unlinked: administrators.length - administratorMemberIds.size,
    },
    members: {
      active: activeMembers.length,
      activeProfiles: activeProfileMemberIds.size,
      activeWithoutProfile: activeMembers.length - activeProfileMemberIds.size,
      pending: members.filter((member) => member.accountStatus === 'pending').length,
      blocked: members.filter((member) => member.accountStatus === 'blocked').length,
      suspended: members.filter((member) => member.accountStatus === 'suspended').length,
    },
    subscriptions: {
      activeRecords: activeSubscriptionRecords.length,
      subscribedMembers: subscribedMemberIds.size,
      totalRecords: subscriptions.length,
    },
    reviewQueue: reviewQueue.length,
    stripe: {
      activeRecords: stripeSnapshot
        ? stripeSnapshot.filter((subscription) => subscription.status === 'active' || subscription.status === 'trialing').length
        : null,
      totalRecords: stripeSnapshot ? stripeSnapshot.length : null,
    },
  }
}
