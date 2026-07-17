import { createHash } from 'node:crypto'

import type {
  MembershipFundingSource,
  MembershipVoucherDuration,
} from '@/lib/membership-support/domain'

export type StripeCouponCreateRequest = {
  duration: 'once'
  percent_off: 100
  currency?: never
  metadata: {
    membership: 'jpv_bootcamp_membership'
    voucherDuration: MembershipVoucherDuration
    fundingSource: Exclude<MembershipFundingSource, 'direct_payment'>
  }
  name: string
}

export type StripePromotionCodeCreateRequest = {
  coupon: string
  customer: string
  max_redemptions: 1
  expires_at: number
  metadata: {
    membership: 'jpv_bootcamp_membership'
    voucherDuration: MembershipVoucherDuration
    fundingSource: Exclude<MembershipFundingSource, 'direct_payment'>
    intendedRecipientEmail: string
    approvalReference: string
  }
}

const SECONDS_PER_DAY = 24 * 60 * 60

export function voucherDurationDays(duration: MembershipVoucherDuration): number {
  return duration === 'one_month' ? 31 : 366
}

export function buildMembershipCouponRequest(params: {
  duration: MembershipVoucherDuration
  fundingSource: Exclude<MembershipFundingSource, 'direct_payment'>
}): StripeCouponCreateRequest {
  const label = params.duration === 'one_month' ? 'One month' : 'One year'
  return {
    duration: 'once',
    percent_off: 100,
    name: `JPV Bootcamp Membership — ${label}`,
    metadata: {
      membership: 'jpv_bootcamp_membership',
      voucherDuration: params.duration,
      fundingSource: params.fundingSource,
    },
  }
}

export function buildCustomerRestrictedPromotionCodeRequest(params: {
  couponId: string
  customerId: string
  intendedRecipientEmail: string
  approvalReference: string
  duration: MembershipVoucherDuration
  fundingSource: Exclude<MembershipFundingSource, 'direct_payment'>
  now?: Date
}): StripePromotionCodeCreateRequest {
  if (!params.couponId.trim()) throw new Error('coupon_id_required')
  if (!params.customerId.trim()) throw new Error('customer_id_required')
  if (!params.intendedRecipientEmail.includes('@')) throw new Error('recipient_email_required')
  if (!params.approvalReference.trim()) throw new Error('approval_reference_required')

  const now = params.now ?? new Date()
  return {
    coupon: params.couponId,
    customer: params.customerId,
    max_redemptions: 1,
    expires_at: Math.floor(now.getTime() / 1000) + voucherDurationDays(params.duration) * SECONDS_PER_DAY,
    metadata: {
      membership: 'jpv_bootcamp_membership',
      voucherDuration: params.duration,
      fundingSource: params.fundingSource,
      intendedRecipientEmail: params.intendedRecipientEmail.trim().toLowerCase(),
      approvalReference: params.approvalReference.trim(),
    },
  }
}

export function deriveMembershipSupportIdempotencyKey(params: {
  operation: 'coupon' | 'promotion_code' | 'deactivate'
  recordId: string
  approvalReference: string
}): string {
  if (!params.recordId.trim()) throw new Error('record_id_required')
  if (!params.approvalReference.trim()) throw new Error('approval_reference_required')

  const digest = createHash('sha256')
    .update(`${params.operation}:${params.recordId.trim()}:${params.approvalReference.trim()}`)
    .digest('hex')
    .slice(0, 32)
  return `jpv-membership-support:${params.operation}:${digest}`
}
