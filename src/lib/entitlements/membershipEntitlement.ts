export type MembershipFundingSource = 'direct_payment' | 'voucher' | 'pay_it_forward'
export type MembershipEntitlementDecision = 'allowed' | 'denied' | 'billing_hold'
export type MembershipEntitlementReason =
  | 'active_direct_membership'
  | 'active_voucher_membership'
  | 'active_pay_it_forward_membership'
  | 'cancelled_until_period_end'
  | 'past_due_within_grace'
  | 'payment_failure_within_grace'
  | 'pending_failed_closed'
  | 'unreconciled_failed_closed'
  | 'reconciliation_mismatch_failed_closed'
  | 'suspended_failed_closed'
  | 'revoked_failed_closed'
  | 'expired_failed_closed'
  | 'deleted_subscription_failed_closed'
  | 'cancelled_after_period_end'
  | 'past_due_outside_grace'
  | 'payment_failure_outside_grace'
  | 'missing_or_unknown_state'

export type MembershipEntitlementInput = {
  lifecycleState?: 'pending' | 'active' | 'past_due' | 'cancelled' | 'expired' | 'suspended' | 'revoked' | 'unreconciled' | null
  subscriptionStatus?: string | null
  periodEnd?: Date | string | null
  cancelAtPeriodEnd?: boolean | null
  paymentStatus?: string | null
  graceEndsAt?: Date | string | null
  reconciliationState?: 'matched' | 'mismatch' | 'pending' | 'failed' | null
  fundingSource?: MembershipFundingSource | null
  now?: Date | string | null
}

export type MembershipEntitlementResult = {
  decision: MembershipEntitlementDecision
  reason: MembershipEntitlementReason
  evidence: Record<string, unknown>
}

function normalizeDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function hasPaymentFailure(paymentStatus: string | null | undefined): boolean {
  const normalized = paymentStatus?.trim().toLowerCase() ?? ''
  return normalized === 'failed' || normalized === 'action_required' || normalized === 'disputed'
}

function isWithinGrace(now: Date, graceEndsAt: Date | null): boolean {
  return Boolean(graceEndsAt && graceEndsAt.getTime() >= now.getTime())
}

export function evaluateMembershipEntitlement(input: MembershipEntitlementInput): MembershipEntitlementResult {
  const now = normalizeDate(input.now) ?? new Date()
  const periodEnd = normalizeDate(input.periodEnd)
  const graceEndsAt = normalizeDate(input.graceEndsAt)
  const lifecycle = input.lifecycleState ?? null
  const status = input.subscriptionStatus?.trim().toLowerCase() ?? null
  const fundingSource = input.fundingSource ?? 'direct_payment'
  const evidence = {
    lifecycleState: lifecycle,
    subscriptionStatus: status,
    periodEnd: periodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: Boolean(input.cancelAtPeriodEnd),
    paymentStatus: input.paymentStatus ?? null,
    graceEndsAt: graceEndsAt?.toISOString() ?? null,
    reconciliationState: input.reconciliationState ?? null,
    fundingSource,
  }

  if (input.reconciliationState === 'mismatch') {
    return { decision: 'denied', reason: 'reconciliation_mismatch_failed_closed', evidence }
  }

  if (input.reconciliationState === 'pending' || input.reconciliationState === 'failed' || lifecycle === 'unreconciled') {
    return { decision: 'denied', reason: 'unreconciled_failed_closed', evidence }
  }

  if (status === 'deleted') {
    return { decision: 'denied', reason: 'deleted_subscription_failed_closed', evidence }
  }

  if (lifecycle === 'pending') {
    return { decision: 'denied', reason: 'pending_failed_closed', evidence }
  }

  if (lifecycle === 'suspended') {
    return { decision: 'denied', reason: 'suspended_failed_closed', evidence }
  }

  if (lifecycle === 'revoked') {
    return { decision: 'denied', reason: 'revoked_failed_closed', evidence }
  }

  if (lifecycle === 'expired') {
    return { decision: 'denied', reason: 'expired_failed_closed', evidence }
  }

  if (lifecycle === 'cancelled' || status === 'canceled') {
    if (periodEnd && periodEnd.getTime() > now.getTime()) {
      return { decision: 'allowed', reason: 'cancelled_until_period_end', evidence }
    }
    return { decision: 'denied', reason: 'cancelled_after_period_end', evidence }
  }

  if (lifecycle === 'past_due' || status === 'past_due' || hasPaymentFailure(input.paymentStatus)) {
    if (isWithinGrace(now, graceEndsAt)) {
      return {
        decision: 'billing_hold',
        reason:
          lifecycle === 'past_due' || status === 'past_due'
            ? 'past_due_within_grace'
            : 'payment_failure_within_grace',
        evidence,
      }
    }
    return {
      decision: 'denied',
      reason:
        lifecycle === 'past_due' || status === 'past_due'
          ? 'past_due_outside_grace'
          : 'payment_failure_outside_grace',
      evidence,
    }
  }

  if (!status || !lifecycle) {
    return { decision: 'denied', reason: 'missing_or_unknown_state', evidence }
  }

  if (fundingSource === 'voucher') {
    return { decision: 'allowed', reason: 'active_voucher_membership', evidence }
  }

  if (fundingSource === 'pay_it_forward') {
    return { decision: 'allowed', reason: 'active_pay_it_forward_membership', evidence }
  }

  return { decision: 'allowed', reason: 'active_direct_membership', evidence }
}
