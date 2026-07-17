import type { MembershipSupportAdminReadModel } from './adminReadModel'
import type {
  MembershipFundingSource,
  MembershipSupportIssuanceState,
  MembershipSupportReconciliationState,
  MembershipVoucherDuration,
} from './domain'

export const membershipSupportCockpitViews = [
  {
    label: 'Membership Support records',
    href: '/admin/collections/payload_membership_support_records',
    description: 'Unified membership support record with voucher, funding, and reconciliation data.',
  },
  {
    label: 'Vouchers',
    href: '/admin/collections/payload_membership_vouchers',
    description: 'Voucher records for approval, issue, expiration, and deactivation.',
  },
  {
    label: 'Pay-it-forward allocations',
    href: '/admin/collections/payload_pay_it_forward_funding',
    description: 'Sponsored allocations awaiting approval or issuance.',
  },
  {
    label: 'Funding sources',
    href: '/admin/collections/payload_membership_funding_sources',
    description: 'Funding provenance and operator ownership for membership support.',
  },
  {
    label: 'Reconciliation records',
    href: '/admin/collections/payload_membership_reconciliations',
    description: 'Stripe shadow and webhook reconciliation records.',
  },
  {
    label: 'Review queue',
    href: '/admin/collections/payload_membership_review_queue_items',
    description: 'Manual review queue for approval, mismatch, and expiry follow-up.',
  },
  {
    label: 'Operator notes',
    href: '/admin/collections/payload_operator_notes',
    description: 'Internal notes for operators and reviewers.',
  },
  {
    label: 'Stripe shadow projections',
    href: '/admin/collections/payload_stripe_shadow_projections',
    description: 'Read-only Stripe shadow projection records.',
  },
  {
    label: 'Audit history',
    href: '/admin/collections/payload_membership_audit_history',
    description: 'Immutable audit history for membership support actions.',
  },
] as const

export const membershipSupportCockpitStatusLabels = [
  'draft',
  'approval required',
  'ready to issue',
  'issued',
  'redeemed',
  'deactivated',
  'expired',
  'failed',
  'reconciliation pending',
  'matched',
  'mismatch',
  'manual review',
] as const

export const membershipSupportCockpitActionLabels = [
  'approve',
  'issue',
  'deactivate',
  'expire',
  'revoke funding',
  'send to review',
  'resolve review',
] as const

export const membershipSupportCockpitFields = [
  'member identity',
  'normalized email',
  'funding source',
  'voucher duration',
  'issuance state',
  'approval state',
  'approval reference',
  'billing cadence',
  'Stripe customer presence',
  'Stripe subscription presence',
  'renewal date',
  'active discount',
  'promotion-code state',
  'reconciliation state',
  'last webhook timestamp',
  'failure reason',
  'review-queue state',
  'operator notes',
  'audit-event count',
] as const

export type MembershipSupportCockpitPromotionCodeState = 'none' | 'pending' | 'active' | 'inactive' | 'failed'
export type MembershipSupportCockpitReviewQueueState = 'none' | 'needs_review' | 'in_review' | 'approved' | 'rejected' | 'closed'
export type MembershipSupportCockpitStatus = (typeof membershipSupportCockpitStatusLabels)[number]
export type MembershipSupportCockpitAction = (typeof membershipSupportCockpitActionLabels)[number]

export type MembershipSupportCockpitInput = {
  admin: MembershipSupportAdminReadModel
  fundingSource: MembershipFundingSource | 'none'
  voucherDuration: MembershipVoucherDuration | null
  approvalState: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'issued' | 'revoked'
  issuanceState: MembershipSupportIssuanceState | 'none'
  approvalReference: string | null
  promotionCodeState: MembershipSupportCockpitPromotionCodeState
  reviewQueueState: MembershipSupportCockpitReviewQueueState
  reconciliationState: MembershipSupportReconciliationState | 'not_started'
  failureReason: string | null
  operatorNotesCount: number
  auditEventCount: number
}

export type MembershipSupportCockpitRow = {
  memberIdentity: string
  normalizedEmail: string
  fundingSource: MembershipFundingSource | 'none'
  voucherDuration: MembershipVoucherDuration | null
  issuanceState: MembershipSupportIssuanceState | 'none'
  approvalState: MembershipSupportCockpitInput['approvalState']
  approvalReference: string | null
  billingCadence: 'monthly' | 'annual' | 'unknown'
  stripeCustomerPresent: boolean
  stripeSubscriptionPresent: boolean
  renewalAt: string | null
  activeDiscountLabel: string | null
  promotionCodeState: MembershipSupportCockpitPromotionCodeState
  reconciliationState: MembershipSupportReconciliationState | 'not_started'
  lastWebhookAt: string | null
  failureReason: string | null
  reviewQueueState: MembershipSupportCockpitReviewQueueState
  operatorNotesCount: number
  auditEventCount: number
  status: MembershipSupportCockpitStatus
  actions: Record<MembershipSupportCockpitAction, boolean>
}

function hasIssuedState(state: MembershipSupportIssuanceState | 'none' | undefined): state is MembershipSupportIssuanceState {
  return state === 'issued' || state === 'redeemed' || state === 'deactivated' || state === 'expired' || state === 'failed' || state === 'approved' || state === 'draft'
}

export function deriveMembershipSupportCockpitStatus(input: MembershipSupportCockpitInput): MembershipSupportCockpitStatus {
  if (input.failureReason || input.reconciliationState === 'failed') return 'failed'
  if (input.reviewQueueState === 'needs_review' || input.reviewQueueState === 'in_review') return 'manual review'
  if (input.approvalState === 'pending_approval') return 'approval required'
  if (input.issuanceState === 'draft' || input.approvalState === 'draft') return 'draft'
  if (input.reconciliationState === 'mismatch') return 'mismatch'
  if (input.reconciliationState === 'pending') return 'reconciliation pending'
  if (input.approvalState === 'approved' && input.admin.billing.hasStripeCustomer && !input.admin.billing.hasSubscription) return 'ready to issue'
  if (input.issuanceState === 'issued' || input.approvalState === 'issued') return 'issued'
  if (input.issuanceState === 'redeemed') return 'redeemed'
  if (input.issuanceState === 'deactivated' || input.approvalState === 'revoked') return 'deactivated'
  if (input.issuanceState === 'expired') return 'expired'
  if (input.reconciliationState === 'matched') return 'matched'
  return 'approval required'
}

export function deriveMembershipSupportCockpitActions(input: MembershipSupportCockpitInput): Record<MembershipSupportCockpitAction, boolean> {
  const needsReview = input.reviewQueueState === 'needs_review' || input.reviewQueueState === 'in_review'
  const hasApproval = input.approvalState === 'approved' || input.approvalState === 'issued'
  const hasIssuedSupport = input.issuanceState === 'issued' || input.issuanceState === 'redeemed'
  const hasClosedSupport = input.issuanceState === 'deactivated' || input.issuanceState === 'expired' || input.approvalState === 'revoked'
  return {
    approve: input.approvalState === 'draft' || input.approvalState === 'pending_approval',
    issue: input.approvalState === 'approved' && input.admin.billing.hasStripeCustomer && input.reconciliationState !== 'mismatch' && !needsReview,
    deactivate: hasIssuedSupport && !hasClosedSupport,
    expire: hasApproval && !hasClosedSupport,
    'revoke funding': hasApproval && !hasClosedSupport,
    'send to review': input.reconciliationState === 'mismatch' || Boolean(input.failureReason) || input.reviewQueueState === 'none',
    'resolve review': needsReview,
  }
}

export function buildMembershipSupportCockpitRow(input: MembershipSupportCockpitInput): MembershipSupportCockpitRow {
  return {
    memberIdentity: `${input.admin.member.id} · ${input.admin.member.email}`,
    normalizedEmail: input.admin.member.email,
    fundingSource: input.fundingSource,
    voucherDuration: input.voucherDuration,
    issuanceState: hasIssuedState(input.issuanceState) ? input.issuanceState : 'none',
    approvalState: input.approvalState,
    approvalReference: input.approvalReference,
    billingCadence: input.admin.billing.billingCadence,
    stripeCustomerPresent: input.admin.billing.hasStripeCustomer,
    stripeSubscriptionPresent: input.admin.billing.hasSubscription,
    renewalAt: input.admin.billing.renewalAt,
    activeDiscountLabel: input.admin.billing.activeDiscountLabel,
    promotionCodeState: input.promotionCodeState,
    reconciliationState: input.reconciliationState,
    lastWebhookAt: input.admin.reconciliation.lastWebhookAt,
    failureReason: input.failureReason ?? input.admin.reconciliation.failureCode,
    reviewQueueState: input.reviewQueueState,
    operatorNotesCount: input.operatorNotesCount,
    auditEventCount: input.auditEventCount,
    status: deriveMembershipSupportCockpitStatus(input),
    actions: deriveMembershipSupportCockpitActions(input),
  }
}
