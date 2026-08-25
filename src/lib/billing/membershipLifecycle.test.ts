import assert from 'node:assert/strict'

import { resolveMembershipLifecycle } from '@/lib/billing/membershipLifecycle'

const base = {
  hasBillingAccount: true,
  paymentStatus: null,
  withinPaymentGrace: false,
  cancelAtPeriodEnd: false,
} as const

assert.deepEqual(resolveMembershipLifecycle({ ...base, subscriptionStatus: 'trialing' }), {
  state: 'active',
  accessAllowed: true,
  reason: 'active_subscription',
})
assert.deepEqual(resolveMembershipLifecycle({ ...base, subscriptionStatus: 'incomplete' }), {
  state: 'pending',
  accessAllowed: false,
  reason: 'pending_activation',
})

console.log('Membership lifecycle trial contract: PASS')
