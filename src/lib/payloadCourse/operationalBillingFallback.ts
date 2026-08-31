import 'server-only'

import {
  getBillingStatus,
  type BillingStatus as OperationalBillingStatus,
} from '@/lib/billing/billingStatusHelper'
import type { BillingAccessContext } from '@/lib/entitlements/evaluateAccess'
import type {
  OperationalBillingContextResolver,
  PayloadCourseAccessAPI,
} from '@/lib/payloadCourse/accessService'

const OPERATIONAL_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
  'unpaid',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'paused',
])

function toBillingAccessContext(
  status: OperationalBillingStatus,
): BillingAccessContext | null {
  const subscriptionStatus = status.subscriptionStatus
  if (
    !status.hasBillingAccount ||
    !subscriptionStatus ||
    !OPERATIONAL_SUBSCRIPTION_STATUSES.has(subscriptionStatus)
  ) {
    return null
  }

  return {
    status: subscriptionStatus as BillingAccessContext['status'],
    lifecycleState: status.membershipStatus,
    subscriptionStatus,
    periodEnd: status.periodEndDate,
    cancelAtPeriodEnd: status.cancelAtPeriodEnd,
    paymentStatus: status.paymentStatus,
    graceEndsAt: status.paymentGraceEndsAt,
  }
}

function resolverForPayload(payload: PayloadCourseAccessAPI): OperationalBillingContextResolver {
  return async (memberId) => {
    try {
      const member = await payload.findByID({
        collection: 'payload_members',
        id: memberId,
        depth: 0,
        overrideAccess: true,
      })
      const email = typeof member?.email === 'string' ? member.email : ''
      if (!email) return null

      return toBillingAccessContext(await getBillingStatus(email))
    } catch {
      // The fallback is an enrichment path. If operational billing is
      // unavailable, the existing Payload fail-closed result remains intact.
      return null
    }
  }
}

/**
 * Adds the operational billing fallback to a Payload instance without
 * replacing or wrapping Payload's own methods. This keeps write-capable
 * callers and request-local caches working exactly as before.
 */
export function attachOperationalBillingFallback<T extends object>(
  payload: T,
): T & PayloadCourseAccessAPI {
  const accessPayload = payload as T & PayloadCourseAccessAPI
  if (accessPayload.resolveOperationalBillingContext) return accessPayload

  Object.defineProperty(accessPayload, 'resolveOperationalBillingContext', {
    configurable: true,
    enumerable: false,
    value: resolverForPayload(accessPayload),
  })

  return accessPayload
}
