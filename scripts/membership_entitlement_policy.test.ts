import assert from 'node:assert/strict'

import {
  evaluateMembershipEntitlement,
  type MembershipEntitlementInput,
} from '../src/lib/entitlements/membershipEntitlement'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`fail - ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

const base: MembershipEntitlementInput = {
  lifecycleState: 'active',
  subscriptionStatus: 'active',
  periodEnd: new Date('2026-08-01T00:00:00.000Z'),
  cancelAtPeriodEnd: false,
  paymentStatus: 'paid',
  graceEndsAt: null,
  reconciliationState: 'matched',
  fundingSource: 'direct_payment',
  legacyStoredPlan: 'pro',
  now: new Date('2026-07-17T00:00:00.000Z'),
}

run('allows active direct-payment membership', () => {
  const result = evaluateMembershipEntitlement(base)
  assert.equal(result.decision, 'allowed')
  assert.equal(result.reason, 'active_direct_membership')
})

run('allows active voucher membership', () => {
  const result = evaluateMembershipEntitlement({
    ...base,
    fundingSource: 'voucher',
  })
  assert.equal(result.decision, 'allowed')
  assert.equal(result.reason, 'active_voucher_membership')
})

run('allows active pay-it-forward membership', () => {
  const result = evaluateMembershipEntitlement({
    ...base,
    fundingSource: 'pay_it_forward',
  })
  assert.equal(result.decision, 'allowed')
  assert.equal(result.reason, 'active_pay_it_forward_membership')
})

run('returns billing hold for past due within grace', () => {
  const result = evaluateMembershipEntitlement({
    ...base,
    lifecycleState: 'past_due',
    subscriptionStatus: 'past_due',
    paymentStatus: 'failed',
    graceEndsAt: new Date('2026-07-20T00:00:00.000Z'),
  })
  assert.equal(result.decision, 'billing_hold')
  assert.equal(result.reason, 'past_due_within_grace')
})

run('fails closed for past due outside grace', () => {
  const result = evaluateMembershipEntitlement({
    ...base,
    lifecycleState: 'past_due',
    subscriptionStatus: 'past_due',
    paymentStatus: 'failed',
    graceEndsAt: new Date('2026-07-16T00:00:00.000Z'),
  })
  assert.equal(result.decision, 'denied')
  assert.equal(result.reason, 'past_due_outside_grace')
})

run('retains access until period end after cancellation', () => {
  const result = evaluateMembershipEntitlement({
    ...base,
    lifecycleState: 'cancelled',
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: true,
    periodEnd: new Date('2026-07-18T00:00:00.000Z'),
  })
  assert.equal(result.decision, 'allowed')
  assert.equal(result.reason, 'cancelled_until_period_end')
})

run('fails closed at the exact cancellation period-end boundary', () => {
  const result = evaluateMembershipEntitlement({
    ...base,
    lifecycleState: 'cancelled',
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: true,
    periodEnd: new Date('2026-07-17T00:00:00.000Z'),
  })
  assert.equal(result.decision, 'denied')
  assert.equal(result.reason, 'cancelled_after_period_end')
})

run('fails closed after cancellation period end', () => {
  const result = evaluateMembershipEntitlement({
    ...base,
    lifecycleState: 'cancelled',
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: true,
    periodEnd: new Date('2026-07-16T00:00:00.000Z'),
  })
  assert.equal(result.decision, 'denied')
  assert.equal(result.reason, 'cancelled_after_period_end')
})

run('fails closed for unreconciled state', () => {
  const result = evaluateMembershipEntitlement({
    ...base,
    lifecycleState: 'unreconciled',
    reconciliationState: 'pending',
  })
  assert.equal(result.decision, 'denied')
  assert.equal(result.reason, 'unreconciled_failed_closed')
})

run('routes legacy pro without verified subscription to manual review', () => {
  const result = evaluateMembershipEntitlement({
    ...base,
    lifecycleState: null,
    subscriptionStatus: null,
    legacyStoredPlan: 'pro',
  })
  assert.equal(result.decision, 'manual_review')
  assert.equal(result.reason, 'legacy_pro_requires_verified_subscription')
})

run('allows legacy pro when verified subscription state is active', () => {
  const result = evaluateMembershipEntitlement({
    ...base,
    legacyStoredPlan: 'pro',
  })
  assert.equal(result.decision, 'allowed')
  assert.equal(result.reason, 'active_direct_membership')
})

run('denies legacy free', () => {
  const result = evaluateMembershipEntitlement({
    ...base,
    lifecycleState: null,
    subscriptionStatus: null,
    legacyStoredPlan: 'free',
  })
  assert.equal(result.decision, 'denied')
  assert.equal(result.reason, 'legacy_free_denied')
})

run('returns billing hold on the exact grace-end boundary', () => {
  const result = evaluateMembershipEntitlement({
    ...base,
    lifecycleState: 'past_due',
    subscriptionStatus: 'past_due',
    paymentStatus: 'failed',
    graceEndsAt: new Date('2026-07-17T00:00:00.000Z'),
  })
  assert.equal(result.decision, 'billing_hold')
  assert.equal(result.reason, 'past_due_within_grace')
})

run('fails closed for suspended state', () => {
  const result = evaluateMembershipEntitlement({
    ...base,
    lifecycleState: 'suspended',
    subscriptionStatus: 'paused',
  })
  assert.equal(result.decision, 'denied')
  assert.equal(result.reason, 'suspended_failed_closed')
})
