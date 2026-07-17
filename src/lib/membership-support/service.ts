import type { MembershipSupportRecord } from '@/lib/membership-support/domain'
import { validateMembershipSupportRecord } from '@/lib/membership-support/domain'
import type { MembershipSupportStripeAdapter } from '@/lib/membership-support/stripeAdapter'
import {
  buildCustomerRestrictedPromotionCodeRequest,
  buildMembershipCouponRequest,
  deriveMembershipSupportIdempotencyKey,
} from '@/lib/membership-support/stripeRequests'

export type MembershipSupportIssuanceResult = {
  couponId: string
  promotionCodeId: string
  stripeCustomerId: string
  reconciliationState: 'matched' | 'mismatch'
  reconciliationReasons: string[]
}

export async function issueMembershipSupportVoucher(params: {
  record: MembershipSupportRecord
  adapter: MembershipSupportStripeAdapter
  now?: Date
}): Promise<MembershipSupportIssuanceResult> {
  const errors = validateMembershipSupportRecord(params.record)
  if (errors.length > 0) throw new Error(`membership_support_invalid:${errors.join(',')}`)
  if (params.record.fundingSource === 'direct_payment') throw new Error('funding_source_not_voucher_backed')
  if (!params.record.voucherDuration) throw new Error('voucher_duration_required')
  if (!params.record.stripeCustomerId) throw new Error('stripe_customer_required')
  if (!params.record.approvalReference) throw new Error('approval_reference_required')

  const couponKey = deriveMembershipSupportIdempotencyKey({
    operation: 'coupon',
    recordId: params.record.id,
    approvalReference: params.record.approvalReference,
  })
  const coupon = await params.adapter.createOrReuseCoupon(
    buildMembershipCouponRequest({
      duration: params.record.voucherDuration,
      fundingSource: params.record.fundingSource,
    }),
    couponKey,
  )

  const promotionKey = deriveMembershipSupportIdempotencyKey({
    operation: 'promotion_code',
    recordId: params.record.id,
    approvalReference: params.record.approvalReference,
  })
  const promotion = await params.adapter.createPromotionCode(
    buildCustomerRestrictedPromotionCodeRequest({
      couponId: coupon.id,
      customerId: params.record.stripeCustomerId,
      intendedRecipientEmail: params.record.intendedRecipientEmail,
      approvalReference: params.record.approvalReference,
      duration: params.record.voucherDuration,
      fundingSource: params.record.fundingSource,
      now: params.now,
    }),
    promotionKey,
  )

  const reconciliation = await params.adapter.reconcile({
    customerId: params.record.stripeCustomerId,
    subscriptionId: params.record.stripeSubscriptionId,
    promotionCodeId: promotion.id,
  })

  return {
    couponId: coupon.id,
    promotionCodeId: promotion.id,
    stripeCustomerId: params.record.stripeCustomerId,
    reconciliationState: reconciliation.matched ? 'matched' : 'mismatch',
    reconciliationReasons: reconciliation.reasons,
  }
}

export async function deactivateMembershipSupportPromotionCode(params: {
  recordId: string
  approvalReference: string
  promotionCodeId: string
  adapter: MembershipSupportStripeAdapter
}): Promise<{ id: string; active: boolean }> {
  const key = deriveMembershipSupportIdempotencyKey({
    operation: 'deactivate',
    recordId: params.recordId,
    approvalReference: params.approvalReference,
  })
  return params.adapter.deactivatePromotionCode(params.promotionCodeId, key)
}
