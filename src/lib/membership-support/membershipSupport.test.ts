import assert from 'node:assert/strict'

import {
  isMembershipSupportRecordReady,
  validateMembershipSupportRecord,
  type MembershipSupportRecord,
} from '@/lib/membership-support/domain'
import {
  buildCustomerRestrictedPromotionCodeRequest,
  buildMembershipCouponRequest,
  deriveMembershipSupportIdempotencyKey,
  voucherDurationDays,
} from '@/lib/membership-support/stripeRequests'
import { buildMembershipSupportAdminReadModel } from '@/lib/membership-support/adminReadModel'

function baseRecord(): MembershipSupportRecord {
  return {
    id: 'support-1',
    fundingSource: 'voucher',
    voucherDuration: 'one_month',
    issuanceState: 'approved',
    intendedRecipientEmail: 'Student@Example.com',
    stripeCustomerId: null,
    stripeCouponId: null,
    stripePromotionCodeId: null,
    stripeSubscriptionId: null,
    billingCadence: 'monthly',
    issuedBy: 'operator-1',
    approvedBy: 'approver-1',
    issuedAt: null,
    expiresAt: null,
    redeemedAt: null,
    deactivatedAt: null,
    reason: 'Approved support funding',
    approvalReference: 'approval-2026-07-16',
    reconciliationState: 'pending',
    lastWebhookAt: null,
  }
}

function main(): void {
  const ready = baseRecord()
  assert.deepEqual(validateMembershipSupportRecord(ready), [])
  assert.equal(isMembershipSupportRecordReady(ready), true)

  const invalidVoucher: MembershipSupportRecord = {
    ...baseRecord(),
    voucherDuration: null,
    approvalReference: null,
    intendedRecipientEmail: 'invalid',
  }
  assert.deepEqual(
    validateMembershipSupportRecord(invalidVoucher),
    ['recipient_email_required', 'voucher_duration_required', 'approval_required'],
  )

  const directPayment: MembershipSupportRecord = {
    ...baseRecord(),
    fundingSource: 'direct_payment',
    voucherDuration: null,
  }
  assert.equal(isMembershipSupportRecordReady(directPayment), true)

  const issuedWithoutStripe = { ...baseRecord(), issuanceState: 'issued' as const }
  assert.deepEqual(validateMembershipSupportRecord(issuedWithoutStripe), [
    'stripe_customer_required',
    'stripe_promotion_code_required',
  ])

  const monthlyCoupon = buildMembershipCouponRequest({ duration: 'one_month', fundingSource: 'voucher' })
  assert.equal(monthlyCoupon.percent_off, 100)
  assert.equal(monthlyCoupon.duration, 'once')
  assert.equal(monthlyCoupon.metadata.voucherDuration, 'one_month')
  assert.equal(monthlyCoupon.metadata.fundingSource, 'voucher')
  assert.equal(voucherDurationDays('one_month'), 31)
  assert.equal(voucherDurationDays('one_year'), 366)

  const promotion = buildCustomerRestrictedPromotionCodeRequest({
    couponId: 'coupon_123',
    customerId: 'cus_123',
    intendedRecipientEmail: 'Student@Example.com',
    approvalReference: 'approval-123',
    duration: 'one_year',
    fundingSource: 'pay_it_forward',
    now: new Date('2026-07-16T00:00:00.000Z'),
  })
  assert.equal(promotion.customer, 'cus_123')
  assert.equal(promotion.max_redemptions, 1)
  assert.equal(promotion.metadata.intendedRecipientEmail, 'student@example.com')
  assert.equal(promotion.metadata.fundingSource, 'pay_it_forward')

  assert.throws(
    () =>
      buildCustomerRestrictedPromotionCodeRequest({
        couponId: '',
        customerId: 'cus_123',
        intendedRecipientEmail: 'student@example.com',
        approvalReference: 'approval-123',
        duration: 'one_month',
        fundingSource: 'voucher',
      }),
    /coupon_id_required/,
  )

  const key1 = deriveMembershipSupportIdempotencyKey({
    operation: 'promotion_code',
    recordId: 'record-1',
    approvalReference: 'approval-1',
  })
  const key2 = deriveMembershipSupportIdempotencyKey({
    operation: 'promotion_code',
    recordId: 'record-1',
    approvalReference: 'approval-1',
  })
  assert.equal(key1, key2)
  assert.match(key1, /^jpv-membership-support:promotion_code:/)

  const admin = buildMembershipSupportAdminReadModel({
    memberId: 'member-1',
    memberEmail: 'Student@Example.com',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    subscriptionStatus: 'active',
    billingCadence: 'yearly',
    renewalAt: new Date('2027-07-16T00:00:00.000Z'),
    activeDiscountLabel: '100% for one year',
    fundingSource: 'pay_it_forward',
    voucherDuration: 'one_year',
    issuanceState: 'redeemed',
    reconciliationState: 'mismatch',
    lastWebhookAt: new Date('2026-07-16T12:00:00.000Z'),
    failureCode: 'subscription_price_mismatch',
  })
  assert.equal(admin.member.email, 'student@example.com')
  assert.equal(admin.billing.billingCadence, 'annual')
  assert.equal(admin.reconciliation.requiresAttention, true)
  assert.equal('stripeCustomerId' in admin.billing, false)

  console.log('membership support foundation tests passed')
}

main()
