import type {
  MembershipFundingSource,
  MembershipSupportIssuanceState,
  MembershipSupportReconciliationState,
  MembershipVoucherDuration,
} from '@/lib/membership-support/domain'

export type MembershipSupportAdminSource = {
  memberId: string
  memberEmail: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  subscriptionStatus: string | null
  billingCadence: string | null
  renewalAt: Date | null
  activeDiscountLabel: string | null
  fundingSource: MembershipFundingSource | null
  voucherDuration: MembershipVoucherDuration | null
  issuanceState: MembershipSupportIssuanceState | null
  reconciliationState: MembershipSupportReconciliationState | null
  lastWebhookAt: Date | null
  failureCode: string | null
}

export type MembershipSupportAdminReadModel = {
  member: {
    id: string
    email: string
  }
  billing: {
    hasStripeCustomer: boolean
    hasSubscription: boolean
    subscriptionStatus: string | null
    billingCadence: 'monthly' | 'annual' | 'unknown'
    renewalAt: string | null
    activeDiscountLabel: string | null
  }
  funding: {
    source: MembershipFundingSource | 'none'
    voucherDuration: MembershipVoucherDuration | null
    issuanceState: MembershipSupportIssuanceState | 'none'
  }
  reconciliation: {
    state: MembershipSupportReconciliationState | 'not_started'
    lastWebhookAt: string | null
    requiresAttention: boolean
    failureCode: string | null
  }
}

function normalizeBillingCadence(value: string | null): 'monthly' | 'annual' | 'unknown' {
  if (!value) return 'unknown'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'monthly' || normalized === 'month') return 'monthly'
  if (normalized === 'annual' || normalized === 'yearly' || normalized === 'year') return 'annual'
  return 'unknown'
}

export function buildMembershipSupportAdminReadModel(
  source: MembershipSupportAdminSource,
): MembershipSupportAdminReadModel {
  const reconciliationState = source.reconciliationState ?? 'not_started'
  return {
    member: {
      id: source.memberId,
      email: source.memberEmail.trim().toLowerCase(),
    },
    billing: {
      hasStripeCustomer: Boolean(source.stripeCustomerId),
      hasSubscription: Boolean(source.stripeSubscriptionId),
      subscriptionStatus: source.subscriptionStatus,
      billingCadence: normalizeBillingCadence(source.billingCadence),
      renewalAt: source.renewalAt?.toISOString() ?? null,
      activeDiscountLabel: source.activeDiscountLabel,
    },
    funding: {
      source: source.fundingSource ?? 'none',
      voucherDuration: source.voucherDuration,
      issuanceState: source.issuanceState ?? 'none',
    },
    reconciliation: {
      state: reconciliationState,
      lastWebhookAt: source.lastWebhookAt?.toISOString() ?? null,
      requiresAttention:
        reconciliationState === 'mismatch' ||
        reconciliationState === 'failed' ||
        Boolean(source.failureCode),
      failureCode: source.failureCode,
    },
  }
}
