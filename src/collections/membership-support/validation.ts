import type {
  MembershipFundingSource,
  MembershipSupportIssuanceState,
  MembershipSupportReconciliationState,
  MembershipVoucherDuration,
} from '@/lib/membership-support/domain'

export function isAllowedFundingSource(value: unknown): value is MembershipFundingSource {
  return value === 'direct_payment' || value === 'voucher' || value === 'pay_it_forward'
}

export function isAllowedVoucherDuration(value: unknown): value is MembershipVoucherDuration {
  return value === 'one_month' || value === 'one_year'
}

export function isAllowedIssuanceState(value: unknown): value is MembershipSupportIssuanceState {
  return value === 'draft' || value === 'approved' || value === 'issued' || value === 'redeemed' || value === 'deactivated' || value === 'expired' || value === 'failed'
}

export function isAllowedReconciliationState(value: unknown): value is MembershipSupportReconciliationState {
  return value === 'pending' || value === 'matched' || value === 'mismatch' || value === 'failed'
}

export function validateApprovalReferenceForState(
  state: unknown,
  approvalReference: unknown,
): true | string {
  if (state === 'draft') return true
  return typeof approvalReference === 'string' && approvalReference.trim().length > 0
    ? true
    : 'Approval reference is required once the record leaves draft.'
}

export function validateIssuedStateReferences(params: {
  issuanceState: unknown
  stripeCustomerId: unknown
  stripePromotionCodeId: unknown
  redeemedAt: unknown
  deactivatedAt: unknown
}): true | string {
  if (!isAllowedIssuanceState(params.issuanceState)) return 'Unknown issuance state.'

  const requiresStripeReferences = ['issued', 'redeemed', 'deactivated', 'expired'].includes(params.issuanceState)
  if (requiresStripeReferences) {
    if (typeof params.stripeCustomerId !== 'string' || !params.stripeCustomerId.trim()) {
      return 'Stripe customer id is required once the voucher is issued.'
    }
    if (typeof params.stripePromotionCodeId !== 'string' || !params.stripePromotionCodeId.trim()) {
      return 'Stripe promotion code id is required once the voucher is issued.'
    }
  }

  if (params.issuanceState === 'redeemed' && !(params.redeemedAt instanceof Date)) {
    return 'Redeemed at is required when the record is redeemed.'
  }

  if (params.issuanceState === 'deactivated' && !(params.deactivatedAt instanceof Date)) {
    return 'Deactivated at is required when the record is deactivated.'
  }

  return true
}

