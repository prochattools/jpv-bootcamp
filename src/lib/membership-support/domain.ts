export type MembershipFundingSource = 'direct_payment' | 'voucher' | 'pay_it_forward'
export type MembershipVoucherDuration = 'one_month' | 'one_year'
export type MembershipSupportIssuanceState =
  | 'draft'
  | 'approved'
  | 'issued'
  | 'redeemed'
  | 'deactivated'
  | 'expired'
  | 'failed'
export type MembershipSupportReconciliationState =
  | 'pending'
  | 'matched'
  | 'mismatch'
  | 'failed'

export type MembershipSupportRecord = {
  id: string
  fundingSource: MembershipFundingSource
  voucherDuration: MembershipVoucherDuration | null
  issuanceState: MembershipSupportIssuanceState
  intendedRecipientEmail: string
  stripeCustomerId: string | null
  stripeCouponId: string | null
  stripePromotionCodeId: string | null
  stripeSubscriptionId: string | null
  billingCadence: 'monthly' | 'annual'
  issuedBy: string | null
  approvedBy: string | null
  issuedAt: Date | null
  expiresAt: Date | null
  redeemedAt: Date | null
  deactivatedAt: Date | null
  reason: string
  approvalReference: string | null
  reconciliationState: MembershipSupportReconciliationState
  lastWebhookAt: Date | null
}

export type MembershipSupportValidationError =
  | 'id_required'
  | 'recipient_email_required'
  | 'reason_required'
  | 'approval_required'
  | 'voucher_duration_required'
  | 'voucher_duration_not_allowed'
  | 'stripe_customer_required'
  | 'stripe_promotion_code_required'
  | 'redeemed_at_required'
  | 'deactivated_at_required'

export function validateMembershipSupportRecord(
  record: MembershipSupportRecord,
): MembershipSupportValidationError[] {
  const errors: MembershipSupportValidationError[] = []
  if (!record.id.trim()) errors.push('id_required')
  if (!record.intendedRecipientEmail.trim() || !record.intendedRecipientEmail.includes('@')) {
    errors.push('recipient_email_required')
  }
  if (!record.reason.trim()) errors.push('reason_required')

  if (record.fundingSource === 'direct_payment') {
    if (record.voucherDuration !== null) errors.push('voucher_duration_not_allowed')
  } else if (!record.voucherDuration) {
    errors.push('voucher_duration_required')
  }

  if (record.issuanceState !== 'draft' && !record.approvalReference?.trim()) {
    errors.push('approval_required')
  }

  if (['issued', 'redeemed', 'deactivated', 'expired'].includes(record.issuanceState)) {
    if (!record.stripeCustomerId) errors.push('stripe_customer_required')
    if (!record.stripePromotionCodeId) errors.push('stripe_promotion_code_required')
  }

  if (record.issuanceState === 'redeemed' && !record.redeemedAt) {
    errors.push('redeemed_at_required')
  }

  if (record.issuanceState === 'deactivated' && !record.deactivatedAt) {
    errors.push('deactivated_at_required')
  }

  return [...new Set(errors)]
}

export function isMembershipSupportRecordReady(record: MembershipSupportRecord): boolean {
  return validateMembershipSupportRecord(record).length === 0
}
