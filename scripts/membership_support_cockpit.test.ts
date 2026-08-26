import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { PayloadMembershipSupportRecords } from '@/collections/membership-support/MembershipSupport'
import { membershipSupportAccess } from '@/collections/membership-support/access'
import {
  membershipSupportCockpitActionLabels,
  membershipSupportCockpitFields,
  membershipSupportCockpitStatusLabels,
  membershipSupportCockpitViews,
  buildMembershipSupportCockpitRow,
  deriveMembershipSupportCockpitActions,
  deriveMembershipSupportCockpitStatus,
  type MembershipSupportCockpitInput,
} from '@/lib/membership-support/cockpit'
import { buildMembershipSupportAdminReadModel } from '@/lib/membership-support/adminReadModel'

function adminReadModel(overrides: Partial<Parameters<typeof buildMembershipSupportAdminReadModel>[0]> = {}) {
  return buildMembershipSupportAdminReadModel({
    memberId: 'member-1',
    memberEmail: 'Student@Example.com',
    stripeCustomerId: 'cus_123',
    stripeSubscriptionId: 'sub_123',
    subscriptionStatus: 'active',
    billingCadence: 'monthly',
    renewalAt: new Date('2026-08-17T00:00:00.000Z'),
    activeDiscountLabel: 'Voucher',
    fundingSource: 'voucher',
    voucherDuration: 'one_month',
    issuanceState: 'issued',
    reconciliationState: 'matched',
    lastWebhookAt: new Date('2026-07-17T00:00:00.000Z'),
    failureCode: null,
    ...overrides,
  })
}

function main(): void {
  assert.equal(PayloadMembershipSupportRecords.access, membershipSupportAccess)
  assert.equal(PayloadMembershipSupportRecords.admin?.group, 'Membership Support')

  assert.deepEqual(
    membershipSupportCockpitViews.map((view) => view.href),
    [
      '/admin/collections/payload_membership_support_records',
      '/admin/collections/payload_membership_vouchers',
      '/admin/collections/payload_pay_it_forward_funding',
      '/admin/collections/payload_membership_funding_sources',
      '/admin/collections/payload_membership_reconciliations',
      '/admin/collections/payload_membership_review_queue_items',
      '/admin/collections/payload_operator_notes',
      '/admin/collections/payload_stripe_shadow_projections',
      '/admin/collections/payload_membership_audit_history',
    ],
  )

  assert.deepEqual(membershipSupportCockpitStatusLabels, [
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
  ])
  assert.deepEqual(membershipSupportCockpitActionLabels, [
    'approve',
    'issue',
    'deactivate',
    'expire',
    'revoke funding',
    'send to review',
    'resolve review',
  ])
  assert.deepEqual(membershipSupportCockpitFields, [
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
  ])

  const draft: MembershipSupportCockpitInput = {
    admin: adminReadModel({
      billingCadence: 'monthly',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      fundingSource: 'voucher',
      voucherDuration: 'one_month',
      issuanceState: 'draft',
      reconciliationState: 'pending',
      activeDiscountLabel: null,
    }),
    fundingSource: 'voucher' as const,
    voucherDuration: 'one_month' as const,
    approvalState: 'draft' as const,
    issuanceState: 'draft' as const,
    approvalReference: null,
    promotionCodeState: 'none' as const,
    reviewQueueState: 'none' as const,
    reconciliationState: 'pending' as const,
    failureReason: null,
    operatorNotesCount: 0,
    auditEventCount: 1,
  }

  const approvalRequired = { ...draft, approvalState: 'pending_approval' as const }
  const readyToIssue = {
    ...draft,
    admin: adminReadModel({
      billingCadence: 'monthly',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: null,
      subscriptionStatus: 'incomplete',
      fundingSource: 'voucher',
      voucherDuration: 'one_month',
      issuanceState: 'approved',
      reconciliationState: 'pending',
      activeDiscountLabel: 'Voucher',
    }),
    approvalState: 'approved' as const,
    issuanceState: 'none' as const,
    approvalReference: 'approval-1',
    reconciliationState: 'not_started' as const,
  }
  const issued = {
    ...readyToIssue,
    admin: adminReadModel({
      billingCadence: 'monthly',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      subscriptionStatus: 'active',
      fundingSource: 'voucher',
      voucherDuration: 'one_month',
      issuanceState: 'issued',
      reconciliationState: 'matched',
      activeDiscountLabel: 'Voucher',
    }),
    issuanceState: 'issued' as const,
    promotionCodeState: 'active' as const,
    reviewQueueState: 'closed' as const,
    reconciliationState: 'matched' as const,
  }
  const redeemed = { ...issued, issuanceState: 'redeemed' as const }
  const deactivated = { ...issued, issuanceState: 'deactivated' as const }
  const expired = { ...issued, issuanceState: 'expired' as const }
  const failed = { ...issued, failureReason: 'subscription_customer_mismatch', reconciliationState: 'failed' as const }
  const reconciliationPending = {
    ...readyToIssue,
    admin: adminReadModel({
      billingCadence: 'monthly',
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: null,
      subscriptionStatus: 'incomplete',
      fundingSource: 'voucher',
      voucherDuration: 'one_month',
      issuanceState: 'approved',
      reconciliationState: 'pending',
      activeDiscountLabel: 'Voucher',
    }),
    reconciliationState: 'pending' as const,
  }
  const matched = {
    ...issued,
    admin: adminReadModel({
      billingCadence: 'monthly',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: null,
      fundingSource: 'voucher',
      voucherDuration: 'one_month',
      issuanceState: 'approved',
      reconciliationState: 'matched',
      activeDiscountLabel: null,
    }),
    approvalState: 'approved' as const,
    issuanceState: 'none' as const,
    reviewQueueState: 'closed' as const,
    reconciliationState: 'matched' as const,
  }
  const mismatch = {
    ...readyToIssue,
    reviewQueueState: 'none' as const,
    reconciliationState: 'mismatch' as const,
  }
  const manualReview = {
    ...readyToIssue,
    reviewQueueState: 'needs_review' as const,
    reconciliationState: 'mismatch' as const,
  }

  assert.equal(deriveMembershipSupportCockpitStatus(draft), 'draft')
  assert.equal(deriveMembershipSupportCockpitStatus(approvalRequired), 'approval required')
  assert.equal(deriveMembershipSupportCockpitStatus(readyToIssue), 'ready to issue')
  assert.equal(deriveMembershipSupportCockpitStatus(issued), 'issued')
  assert.equal(deriveMembershipSupportCockpitStatus(redeemed), 'redeemed')
  assert.equal(deriveMembershipSupportCockpitStatus(deactivated), 'deactivated')
  assert.equal(deriveMembershipSupportCockpitStatus(expired), 'expired')
  assert.equal(deriveMembershipSupportCockpitStatus(failed), 'failed')
  assert.equal(deriveMembershipSupportCockpitStatus(reconciliationPending), 'reconciliation pending')
  assert.equal(deriveMembershipSupportCockpitStatus(matched), 'matched')
  assert.equal(deriveMembershipSupportCockpitStatus(mismatch), 'mismatch')
  assert.equal(deriveMembershipSupportCockpitStatus(manualReview), 'manual review')

  assert.equal(deriveMembershipSupportCockpitActions(draft).approve, true)
  assert.equal(deriveMembershipSupportCockpitActions(approvalRequired).approve, true)
  assert.equal(deriveMembershipSupportCockpitActions(readyToIssue).issue, true)
  assert.equal(deriveMembershipSupportCockpitActions(issued).deactivate, true)
  assert.equal(deriveMembershipSupportCockpitActions(issued).expire, true)
  assert.equal(deriveMembershipSupportCockpitActions(issued)['revoke funding'], true)
  assert.equal(deriveMembershipSupportCockpitActions(mismatch)['send to review'], true)
  assert.equal(deriveMembershipSupportCockpitActions(manualReview)['resolve review'], true)

  const row = buildMembershipSupportCockpitRow({
    ...issued,
    approvalReference: 'approval-2',
    operatorNotesCount: 3,
    auditEventCount: 8,
  } satisfies MembershipSupportCockpitInput)
  assert.equal(row.memberIdentity, 'member-1 · student@example.com')
  assert.equal(row.normalizedEmail, 'student@example.com')
  assert.equal(row.stripeCustomerPresent, true)
  assert.equal(row.stripeSubscriptionPresent, true)
  assert.equal(row.status, 'issued')
  assert.equal(Object.prototype.hasOwnProperty.call(row, 'stripeCustomerId'), false)
  assert.equal(Object.prototype.hasOwnProperty.call(row, 'stripeSubscriptionId'), false)

  const cockpitSource = readFileSync('src/lib/membership-support/cockpit.ts', 'utf8')
  const dashboard = readFileSync('src/components/payload/JPVAdminDashboard.tsx', 'utf8')
  for (const forbidden of [/\bFree\b/i, /\bPro\b/i, /fetch\(/i, /stripe\./i, /sk_live|whsec_/i, /process\.env\./i]) {
    assert.doesNotMatch(cockpitSource, forbidden)
    assert.doesNotMatch(dashboard, forbidden)
  }

  console.log('membership support cockpit tests passed')
}

main()
