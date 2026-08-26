import assert from 'node:assert/strict'

import type { MembershipSupportRecord } from '@/lib/membership-support/domain'
import {
  InMemoryMembershipSupportStripeAdapter,
  type MembershipSupportStripeAdapter,
} from '@/lib/membership-support/stripeAdapter'
import {
  deactivateMembershipSupportPromotionCode,
  issueMembershipSupportVoucher,
} from '@/lib/membership-support/service'

function record(overrides: Partial<MembershipSupportRecord> = {}): MembershipSupportRecord {
  return {
    id: 'support-1',
    fundingSource: 'voucher',
    voucherDuration: 'one_month',
    issuanceState: 'approved',
    intendedRecipientEmail: 'student@example.com',
    stripeCustomerId: 'cus_1',
    stripeCouponId: null,
    stripePromotionCodeId: null,
    stripeSubscriptionId: 'sub_1',
    billingCadence: 'monthly',
    issuedBy: 'operator-1',
    approvedBy: 'approver-1',
    issuedAt: null,
    expiresAt: null,
    redeemedAt: null,
    deactivatedAt: null,
    reason: 'Approved support',
    approvalReference: 'approval-1',
    reconciliationState: 'pending',
    lastWebhookAt: null,
    ...overrides,
  }
}

class FailingAdapter implements MembershipSupportStripeAdapter {
  async createOrReuseCoupon(): Promise<never> {
    throw new Error('provider_failure')
  }
  async createPromotionCode(): Promise<never> {
    throw new Error('provider_failure')
  }
  async deactivatePromotionCode(): Promise<never> {
    throw new Error('provider_failure')
  }
  async retrieveSubscription(): Promise<null> {
    return null
  }
  async previewInvoice(): Promise<never> {
    throw new Error('provider_failure')
  }
  async reconcile(): Promise<never> {
    throw new Error('provider_failure')
  }
}

async function main(): Promise<void> {
  const adapter = new InMemoryMembershipSupportStripeAdapter()
  adapter.seedSubscription({ id: 'sub_1', customerId: 'cus_1', priceId: 'price_monthly', status: 'active' })

  const issued = await issueMembershipSupportVoucher({
    record: record(),
    adapter,
    now: new Date('2026-07-16T00:00:00.000Z'),
  })
  assert.equal(issued.reconciliationState, 'matched')
  assert.deepEqual(issued.reconciliationReasons, [])

  const retry = await issueMembershipSupportVoucher({
    record: record(),
    adapter,
    now: new Date('2026-07-16T00:00:00.000Z'),
  })
  assert.equal(retry.couponId, issued.couponId)
  assert.equal(retry.promotionCodeId, issued.promotionCodeId)

  const payItForward = await issueMembershipSupportVoucher({
    record: record({
      id: 'support-2',
      fundingSource: 'pay_it_forward',
      voucherDuration: 'one_year',
      billingCadence: 'annual',
      approvalReference: 'approval-2',
    }),
    adapter,
    now: new Date('2026-07-16T00:00:00.000Z'),
  })
  assert.equal(payItForward.reconciliationState, 'matched')
  assert.notEqual(payItForward.couponId, issued.couponId)

  const deactivated = await deactivateMembershipSupportPromotionCode({
    recordId: 'support-1',
    approvalReference: 'approval-1',
    promotionCodeId: issued.promotionCodeId,
    adapter,
  })
  assert.equal(deactivated.active, false)

  const mismatchAdapter = new InMemoryMembershipSupportStripeAdapter()
  mismatchAdapter.seedSubscription({ id: 'sub_1', customerId: 'cus_other', priceId: 'price_monthly', status: 'active' })
  const mismatch = await issueMembershipSupportVoucher({
    record: record(),
    adapter: mismatchAdapter,
  })
  assert.equal(mismatch.reconciliationState, 'mismatch')
  assert.deepEqual(mismatch.reconciliationReasons, ['subscription_customer_mismatch'])

  await assert.rejects(
    () => issueMembershipSupportVoucher({ record: record({ stripeCustomerId: null }), adapter }),
    /stripe_customer_required/,
  )
  await assert.rejects(
    () => issueMembershipSupportVoucher({ record: record(), adapter: new FailingAdapter() }),
    /provider_failure/,
  )

  console.log('test mode membership support Stripe adapter tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
