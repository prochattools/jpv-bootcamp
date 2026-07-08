import type Stripe from 'stripe'

import type {
  PayloadCourseAccessAPI,
  PayloadId,
} from '@/lib/payloadCourse/accessService'

export const MEMBER_BILLING_PORTAL_RETURN_URL =
  'https://jpvbootcamp.com/portal/billing'

type BillingPortalSessionClient = {
  billingPortal: {
    sessions: {
      create(args: {
        customer: string
        return_url: string
        configuration: string
      }): Promise<Pick<Stripe.BillingPortal.Session, 'url'>>
    }
  }
}

export type MemberBillingPortalOptions = {
  stripe?: BillingPortalSessionClient
  portalConfigurationId?: string
}

export class MemberBillingPortalUnavailableError extends Error {
  readonly code:
    | 'billing_account_missing'
    | 'stripe_customer_missing'
    | 'portal_session_unavailable'

  constructor(
    code:
      | 'billing_account_missing'
      | 'stripe_customer_missing'
      | 'portal_session_unavailable'
  ) {
    super(code)
    this.name = 'MemberBillingPortalUnavailableError'
    this.code = code
  }
}

function storedStripeCustomerId(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim()
  return normalized || null
}

export async function createMemberBillingPortalSession(
  payload: PayloadCourseAccessAPI,
  memberId: PayloadId,
  options: MemberBillingPortalOptions = {}
): Promise<string> {
  const normalizedMemberId = String(memberId)
  const result = await payload.find({
    collection: 'payload_billing_accounts',
    where: {
      member: { equals: normalizedMemberId },
    },
    limit: 1,
    depth: 0,
    sort: '-updatedAt',
    overrideAccess: true,
  })

  const billingAccount = result.docs[0]
  if (!billingAccount) {
    throw new MemberBillingPortalUnavailableError('billing_account_missing')
  }

  const stripeCustomerId = storedStripeCustomerId(billingAccount.stripeCustomerId)
  if (!stripeCustomerId) {
    throw new MemberBillingPortalUnavailableError('stripe_customer_missing')
  }

  const stripe =
    options.stripe ?? (await import('@/lib/stripe')).getStripe()
  const portalConfigurationId =
    options.portalConfigurationId ??
    (await import('@/lib/stripe-config')).getStripeConfig().portalConfigurationId
  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: MEMBER_BILLING_PORTAL_RETURN_URL,
    configuration: portalConfigurationId,
  })

  if (!session.url) {
    throw new MemberBillingPortalUnavailableError('portal_session_unavailable')
  }

  return session.url
}
