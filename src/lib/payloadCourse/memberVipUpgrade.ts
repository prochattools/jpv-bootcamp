import type {
  PayloadCourseAccessAPI,
  PayloadId,
} from '@/lib/payloadCourse/accessService'
import {
  createMemberBillingPortalSession,
  type MemberBillingPortalOptions,
} from '@/lib/payloadCourse/memberBillingPortal'

export class MemberVipUpgradeUnavailableError extends Error {
  readonly code:
    | 'pro_subscription_missing'
    | 'pro_subscription_ineligible'

  constructor(
    code: 'pro_subscription_missing' | 'pro_subscription_ineligible'
  ) {
    super(code)
    this.name = 'MemberVipUpgradeUnavailableError'
    this.code = code
  }
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

export async function createAuthenticatedVipUpgradeSession(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  options: MemberBillingPortalOptions = {}
): Promise<string> {
  const normalizedMemberId = String(memberId)
  const result = await payload.find({
    collection: 'payload_subscriptions',
    where: {
      member: { equals: normalizedMemberId },
    },
    limit: 25,
    depth: 0,
    sort: '-updatedAt',
    overrideAccess: true,
  })

  const proSubscription = result.docs.find(
    (subscription) => asString(subscription.plan) === 'pro'
  )
  if (!proSubscription) {
    throw new MemberVipUpgradeUnavailableError('pro_subscription_missing')
  }

  const status = asString(proSubscription.status)
  if (
    (status !== 'active' && status !== 'trialing') ||
    proSubscription.cancelAtPeriodEnd === true
  ) {
    throw new MemberVipUpgradeUnavailableError('pro_subscription_ineligible')
  }

  return createMemberBillingPortalSession(payload, normalizedMemberId, options)
}
