import assert from 'node:assert/strict'

import { InMemoryMembershipSupportStripeAdapter } from '@/lib/membership-support/stripeAdapter'
import {
  MembershipSupportCommandService,
  type MembershipSupportCommandContext,
  type MembershipSupportPayItForwardCommand,
  type MembershipSupportVoucherCommand,
} from '@/lib/membership-support/service'
import type {
  DraftVoucherInput,
  MembershipSupportPayItForwardAllocationRecord,
  MembershipSupportProjectionRecord,
  MembershipSupportVoucherRecord,
  MembershipSupportWorkflowReviewQueueItem,
  PayItForwardAllocationInput,
} from '@/lib/membership-support/workflows'
import { InMemoryMembershipSupportWorkflowJournal } from '@/lib/membership-support/workflows'

function now(value = '2026-07-17T00:00:00.000Z'): Date {
  return new Date(value)
}

function baseContext(overrides: Partial<MembershipSupportCommandContext> = {}): MembershipSupportCommandContext {
  return {
    operatorId: 'operator-1',
    operatorRole: 'admin',
    now: now(),
    recordId: 'record-1',
    idempotencyKey: 'key-1',
    approvalReference: 'approval-1',
    expectedCurrentState: null,
    ...overrides,
  }
}

function voucherDraft(overrides: Partial<DraftVoucherInput> = {}) {
  return {
    id: 'voucher-1',
    memberId: 'member-1',
    memberEmail: 'Student@Example.com',
    voucherDuration: 'one_month' as const,
    billingCadence: 'monthly' as const,
    fundingSource: 'voucher' as const,
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    reason: 'Voucher created for approved member support',
    notes: 'Internal note',
    metadata: { channel: 'admin' },
    ...overrides,
  }
}

function allocationDraft(
  overrides: Partial<PayItForwardAllocationInput & { stripeCouponId?: string | null; stripePromotionCodeId?: string | null }> = {},
): PayItForwardAllocationInput & { stripeCouponId?: string | null; stripePromotionCodeId?: string | null } {
  return {
    id: 'allocation-1',
    memberId: 'member-1',
    memberEmail: 'Student@Example.com',
    donorName: 'Alice Donor',
    billingCadence: 'monthly' as const,
    allocatedAmountMinor: 5000,
    currency: 'gbp',
    stripeCustomerId: 'cus_1',
    stripeSubscriptionId: 'sub_1',
    stripeCouponId: null,
    stripePromotionCodeId: null,
    reason: 'Pay-it-forward allocation created',
    notes: 'Sponsored by donor',
    metadata: { channel: 'admin' },
    ...overrides,
  }
}

function assertFrozen(value: unknown): void {
  assert.equal(Object.isFrozen(value), true)
}

async function main(): Promise<void> {
  const journal = new InMemoryMembershipSupportWorkflowJournal()
  const adapter = new InMemoryMembershipSupportStripeAdapter()
  adapter.seedSubscription({ id: 'sub_1', customerId: 'cus_1', priceId: 'price_monthly', status: 'active' })

  const service = new MembershipSupportCommandService({ journal })

  const createdDraft = await service.executeVoucherCommand({
    command: 'create_draft',
    input: voucherDraft(),
    context: baseContext({ recordId: 'voucher-1', idempotencyKey: 'voucher-draft-1', approvalReference: null }),
  })
  assert.equal(createdDraft.ok, true)
  assert.equal(createdDraft.updatedVoucher?.approvalState, 'draft')
  assertFrozen(createdDraft.auditEvent)

  const submittedDraft = await service.executeVoucherCommand({
    command: 'submit_for_approval',
    voucher: createdDraft.updatedVoucher as MembershipSupportVoucherRecord,
    context: baseContext({
      recordId: 'voucher-1',
      idempotencyKey: 'voucher-submit-1',
      approvalReference: 'submit-1',
      expectedCurrentState: { approvalState: 'draft' },
    }),
  })
  assert.equal(submittedDraft.ok, true)
  assert.equal(submittedDraft.updatedVoucher?.approvalState, 'pending_approval')
  assert.equal(submittedDraft.reviewQueueItem?.queueReason, 'approval_required')

  const approvedDraft = await service.executeVoucherCommand({
    command: 'approve',
    voucher: submittedDraft.updatedVoucher as MembershipSupportVoucherRecord,
    context: baseContext({
      recordId: 'voucher-1',
      idempotencyKey: 'voucher-approve-1',
      approvalReference: 'approval-2',
      expectedCurrentState: { approvalState: 'pending_approval' },
    }),
  })
  assert.equal(approvedDraft.ok, true)
  assert.equal(approvedDraft.updatedVoucher?.approvalState, 'approved')
  assertFrozen(approvedDraft.auditEvent)

  const issuedMonthly = await service.executeVoucherCommand({
    command: 'issue_one_month',
    voucher: approvedDraft.updatedVoucher as MembershipSupportVoucherRecord,
    adapter,
    context: baseContext({
      recordId: 'voucher-1',
      idempotencyKey: 'voucher-issue-1',
      approvalReference: 'approval-3',
      expectedCurrentState: { approvalState: 'approved' },
    }),
  })
  assert.equal(issuedMonthly.ok, true)
  assert.equal(issuedMonthly.updatedVoucher?.approvalState, 'issued')
  assert.equal(issuedMonthly.updatedWorkflowProjection?.reconciliationState, 'matched')
  assert.equal(issuedMonthly.couponProjection?.request.metadata.voucherDuration, 'one_month')
  assert.equal(issuedMonthly.promotionCodeProjection?.request.customer, 'cus_1')
  assert.equal(issuedMonthly.promotionCodeProjection?.request.max_redemptions, 1)
  assertFrozen(issuedMonthly.auditEvent)

  const issuedMonthlyRetry = await service.executeVoucherCommand({
    command: 'issue_one_month',
    voucher: approvedDraft.updatedVoucher as MembershipSupportVoucherRecord,
    adapter,
    context: baseContext({
      recordId: 'voucher-1',
      idempotencyKey: 'voucher-issue-1',
      approvalReference: 'approval-3',
      expectedCurrentState: { approvalState: 'approved' },
    }),
  })
  assert.equal(issuedMonthlyRetry.idempotencyResult, 'reused')
  assert.equal(issuedMonthlyRetry.promotionCodeProjection?.id, issuedMonthly.promotionCodeProjection?.id)

  const voucherTwoDraft = await service.executeVoucherCommand({
    command: 'create_draft',
    input: voucherDraft({ id: 'voucher-2', memberEmail: 'student2@example.com', stripeCustomerId: 'cus_1' }),
    context: baseContext({ recordId: 'voucher-2', idempotencyKey: 'voucher-draft-2', approvalReference: null }),
  })
  const voucherTwoApproved = await service.executeVoucherCommand({
    command: 'approve',
    voucher: (await service.executeVoucherCommand({
      command: 'submit_for_approval',
      voucher: voucherTwoDraft.updatedVoucher as MembershipSupportVoucherRecord,
      context: baseContext({
        recordId: 'voucher-2',
        idempotencyKey: 'voucher-submit-2',
        approvalReference: 'submit-2',
        expectedCurrentState: { approvalState: 'draft' },
      }),
    })).updatedVoucher as MembershipSupportVoucherRecord,
    context: baseContext({
      recordId: 'voucher-2',
      idempotencyKey: 'voucher-approve-2',
      approvalReference: 'approval-4',
      expectedCurrentState: { approvalState: 'pending_approval' },
    }),
  })
  const issuedMonthlyTwo = await service.executeVoucherCommand({
    command: 'issue_one_month',
    voucher: voucherTwoApproved.updatedVoucher as MembershipSupportVoucherRecord,
    adapter,
    context: baseContext({
      recordId: 'voucher-2',
      idempotencyKey: 'voucher-issue-2',
      approvalReference: 'approval-5',
      expectedCurrentState: { approvalState: 'approved' },
    }),
  })
  assert.equal(issuedMonthlyTwo.couponProjection?.id, issuedMonthly.couponProjection?.id)

  const annualDraft = await service.executeVoucherCommand({
    command: 'create_draft',
    input: voucherDraft({ id: 'voucher-3', voucherDuration: 'one_year', billingCadence: 'annual' }),
    context: baseContext({ recordId: 'voucher-3', idempotencyKey: 'voucher-draft-3', approvalReference: null }),
  })
  const annualApproved = await service.executeVoucherCommand({
    command: 'approve',
    voucher: (await service.executeVoucherCommand({
      command: 'submit_for_approval',
      voucher: annualDraft.updatedVoucher as MembershipSupportVoucherRecord,
      context: baseContext({
        recordId: 'voucher-3',
        idempotencyKey: 'voucher-submit-3',
        approvalReference: 'submit-3',
        expectedCurrentState: { approvalState: 'draft' },
      }),
    })).updatedVoucher as MembershipSupportVoucherRecord,
    context: baseContext({
      recordId: 'voucher-3',
      idempotencyKey: 'voucher-approve-3',
      approvalReference: 'approval-6',
      expectedCurrentState: { approvalState: 'pending_approval' },
    }),
  })
  const issuedAnnual = await service.executeVoucherCommand({
    command: 'issue_one_year',
    voucher: annualApproved.updatedVoucher as MembershipSupportVoucherRecord,
    adapter,
    context: baseContext({
      recordId: 'voucher-3',
      idempotencyKey: 'voucher-issue-3',
      approvalReference: 'approval-7',
      expectedCurrentState: { approvalState: 'approved' },
    }),
  })
  assert.equal(issuedAnnual.updatedWorkflowProjection?.voucherDuration, 'one_year')

  const deactivated = await service.executeVoucherCommand({
    command: 'deactivate_unused',
    voucher: issuedAnnual.updatedVoucher as MembershipSupportVoucherRecord,
    context: baseContext({
      recordId: 'voucher-3',
      idempotencyKey: 'voucher-deactivate-3',
      approvalReference: 'approval-8',
      expectedCurrentState: { approvalState: 'issued' },
    }),
  })
  assert.equal(deactivated.updatedVoucher?.redemptionState, 'deactivated')

  const expiredDraft = await service.executeVoucherCommand({
    command: 'create_draft',
    input: voucherDraft({ id: 'voucher-4' }),
    context: baseContext({ recordId: 'voucher-4', idempotencyKey: 'voucher-draft-4', approvalReference: null }),
  })
  const expiredApproved = await service.executeVoucherCommand({
    command: 'approve',
    voucher: (await service.executeVoucherCommand({
      command: 'submit_for_approval',
      voucher: expiredDraft.updatedVoucher as MembershipSupportVoucherRecord,
      context: baseContext({
        recordId: 'voucher-4',
        idempotencyKey: 'voucher-submit-4',
        approvalReference: 'submit-4',
        expectedCurrentState: { approvalState: 'draft' },
      }),
    })).updatedVoucher as MembershipSupportVoucherRecord,
    context: baseContext({
      recordId: 'voucher-4',
      idempotencyKey: 'voucher-approve-4',
      approvalReference: 'approval-9',
      expectedCurrentState: { approvalState: 'pending_approval' },
    }),
  })
  const expired = await service.executeVoucherCommand({
    command: 'mark_expired',
    voucher: expiredApproved.updatedVoucher as MembershipSupportVoucherRecord,
    context: baseContext({
      recordId: 'voucher-4',
      idempotencyKey: 'voucher-expire-4',
      approvalReference: 'approval-10',
      expectedCurrentState: { approvalState: 'approved' },
    }),
  })
  assert.equal(expired.updatedVoucher?.redemptionState, 'expired')

  const directPaymentRejected = await service.executeVoucherCommand({
    command: 'issue_one_month',
    voucher: {
      ...(approvedDraft.updatedVoucher as MembershipSupportVoucherRecord),
      id: 'voucher-direct',
      fundingSource: 'direct_payment' as never,
    },
    adapter,
    context: baseContext({
      recordId: 'voucher-direct',
      idempotencyKey: 'voucher-direct-1',
      approvalReference: 'approval-11',
      expectedCurrentState: { approvalState: 'approved' },
    }),
  })
  assert.equal(directPaymentRejected.failureClassification, 'direct_non_stripe_sponsored_access_rejection')

  const missingOperator = await service.executeVoucherCommand({
    command: 'create_draft',
    input: voucherDraft({ id: 'voucher-ops-missing' }),
    context: baseContext({ recordId: 'voucher-ops-missing', idempotencyKey: 'voucher-ops-missing-1', operatorId: '' }),
  })
  assert.equal(missingOperator.failureClassification, 'missing_operator')

  const missingApproval = await service.executeVoucherCommand({
    command: 'approve',
    voucher: createdDraft.updatedVoucher as MembershipSupportVoucherRecord,
    context: baseContext({
      recordId: 'voucher-1',
      idempotencyKey: 'voucher-approve-missing-1',
      approvalReference: null,
      expectedCurrentState: { approvalState: 'draft' },
    }),
  })
  assert.equal(missingApproval.failureClassification, 'missing_approval')

  const illegalTransition = await service.executeVoucherCommand({
    command: 'approve',
    voucher: createdDraft.updatedVoucher as MembershipSupportVoucherRecord,
    context: baseContext({
      recordId: 'voucher-1',
      idempotencyKey: 'voucher-approve-illegal',
      approvalReference: 'approval-12',
      expectedCurrentState: { approvalState: 'approved' },
    }),
  })
  assert.equal(illegalTransition.failureClassification, 'illegal_transition')

  const mismatchAdapter = new InMemoryMembershipSupportStripeAdapter()
  mismatchAdapter.seedSubscription({ id: 'sub_1', customerId: 'cus_other', priceId: 'price_monthly', status: 'active' })
  const mismatchIssued = await service.executeVoucherCommand({
    command: 'issue_one_month',
    voucher: approvedDraft.updatedVoucher as MembershipSupportVoucherRecord,
    adapter: mismatchAdapter,
    context: baseContext({
      recordId: 'voucher-1',
      idempotencyKey: 'voucher-issue-mismatch',
      approvalReference: 'approval-13',
      expectedCurrentState: { approvalState: 'approved' },
    }),
  })
  assert.equal(mismatchIssued.ok, false)
  assert.equal(mismatchIssued.failureClassification, 'reconciliation_mismatch')
  assert.equal(mismatchIssued.reviewQueueItem?.queueReason, 'webhook_mismatch')

  const routed = await service.executeVoucherCommand({
    command: 'route_mismatch_to_review',
    projection: mismatchIssued.updatedWorkflowProjection as MembershipSupportProjectionRecord,
    context: baseContext({
      recordId: mismatchIssued.updatedWorkflowProjection?.id ?? 'voucher-1',
      idempotencyKey: 'voucher-route-1',
      approvalReference: 'approval-14',
      expectedCurrentState: { reconciliationState: 'mismatch' },
    }),
  })
  assert.equal(routed.reviewQueueItem?.queueReason, 'webhook_mismatch')

  const resolved = await service.executeVoucherCommand({
    command: 'resolve_review',
    reviewQueueItem: routed.reviewQueueItem as MembershipSupportWorkflowReviewQueueItem,
    context: baseContext({
      recordId: routed.reviewQueueItem?.id ?? 'review-1',
      idempotencyKey: 'voucher-resolve-1',
      approvalReference: 'approval-15',
      expectedCurrentState: { queueState: 'needs_review' },
    }),
  })
  assert.equal(resolved.reviewQueueItem?.queueState, 'closed')

  const voucherRetry = await service.executeVoucherCommand({
    command: 'retry_failed_issuance',
    voucher: {
      ...(mismatchIssued.updatedVoucher as MembershipSupportVoucherRecord),
      approvalState: 'failed',
    },
    adapter,
    context: baseContext({
      recordId: 'voucher-1',
      idempotencyKey: 'voucher-retry-1',
      approvalReference: 'approval-16',
      expectedCurrentState: { approvalState: 'failed' },
    }),
  })
  assert.equal(voucherRetry.idempotencyResult, 'retried')

  const allocationDraftResult = await service.executePayItForwardCommand({
    command: 'create_funding_allocation',
    input: allocationDraft({ id: 'allocation-1', billingCadence: 'monthly' }),
    context: baseContext({ recordId: 'allocation-1', idempotencyKey: 'allocation-draft-1', approvalReference: null }),
  })
  assert.equal(allocationDraftResult.updatedAllocation?.approvalState, 'draft')

  const allocationSubmitted = await service.executePayItForwardCommand({
    command: 'submit_for_approval',
    allocation: allocationDraftResult.updatedAllocation as MembershipSupportPayItForwardAllocationRecord,
    context: baseContext({
      recordId: 'allocation-1',
      idempotencyKey: 'allocation-submit-1',
      approvalReference: 'allocation-submit-1',
      expectedCurrentState: { approvalState: 'draft' },
    }),
  })
  assert.equal(allocationSubmitted.updatedAllocation?.approvalState, 'pending_approval')

  const allocationApproved = await service.executePayItForwardCommand({
    command: 'approve',
    allocation: allocationSubmitted.updatedAllocation as MembershipSupportPayItForwardAllocationRecord,
    context: baseContext({
      recordId: 'allocation-1',
      idempotencyKey: 'allocation-approve-1',
      approvalReference: 'allocation-approve-1',
      expectedCurrentState: { approvalState: 'pending_approval' },
    }),
  })
  assert.equal(allocationApproved.updatedAllocation?.approvalState, 'approved')

  const allocationIssued = await service.executePayItForwardCommand({
    command: 'issue_one_month_funded_membership',
    allocation: allocationApproved.updatedAllocation as MembershipSupportPayItForwardAllocationRecord,
    adapter,
    context: baseContext({
      recordId: 'allocation-1',
      idempotencyKey: 'allocation-issue-1',
      approvalReference: 'allocation-issue-1',
      expectedCurrentState: { approvalState: 'approved' },
    }),
  })
  assert.equal(allocationIssued.ok, true)
  assert.equal(allocationIssued.updatedAllocation?.approvalState, 'issued')
  assert.equal(allocationIssued.couponProjection?.request.metadata.voucherDuration, 'one_month')
  assert.equal(allocationIssued.promotionCodeProjection?.request.customer, 'cus_1')

  const allocationIssuedAnnual = await service.executePayItForwardCommand({
    command: 'issue_one_year_funded_membership',
    allocation: {
      ...(allocationApproved.updatedAllocation as MembershipSupportPayItForwardAllocationRecord),
      id: 'allocation-2',
      billingCadence: 'annual',
      approvalReference: 'allocation-approve-2',
      approvalState: 'approved',
    },
    adapter,
    context: baseContext({
      recordId: 'allocation-2',
      idempotencyKey: 'allocation-issue-2',
      approvalReference: 'allocation-issue-2',
      expectedCurrentState: { approvalState: 'approved' },
    }),
  })
  assert.equal(allocationIssuedAnnual.updatedWorkflowProjection?.voucherDuration, 'one_year')

  const allocationRevoked = await service.executePayItForwardCommand({
    command: 'revoke_unused_allocation',
    allocation: allocationIssuedAnnual.updatedAllocation as MembershipSupportPayItForwardAllocationRecord,
    context: baseContext({
      recordId: 'allocation-2',
      idempotencyKey: 'allocation-revoke-1',
      approvalReference: 'allocation-revoke-1',
      expectedCurrentState: { approvalState: 'issued' },
    }),
  })
  assert.equal(allocationRevoked.updatedAllocation?.approvalState, 'revoked')

  const allocationMismatchAdapter = new InMemoryMembershipSupportStripeAdapter()
  allocationMismatchAdapter.seedSubscription({ id: 'sub_1', customerId: 'cus_other', priceId: 'price_monthly', status: 'active' })
  const allocationMismatch = await service.executePayItForwardCommand({
    command: 'issue_one_month_funded_membership',
    allocation: allocationApproved.updatedAllocation as MembershipSupportPayItForwardAllocationRecord,
    adapter: allocationMismatchAdapter,
    context: baseContext({
      recordId: 'allocation-1',
      idempotencyKey: 'allocation-issue-mismatch',
      approvalReference: 'allocation-issue-mismatch',
      expectedCurrentState: { approvalState: 'approved' },
    }),
  })
  assert.equal(allocationMismatch.failureClassification, 'reconciliation_mismatch')
  assert.equal(allocationMismatch.reviewQueueItem?.queueReason, 'webhook_mismatch')

  const allocationResolved = await service.executePayItForwardCommand({
    command: 'resolve_review',
    reviewQueueItem: allocationMismatch.reviewQueueItem as MembershipSupportWorkflowReviewQueueItem,
    context: baseContext({
      recordId: allocationMismatch.reviewQueueItem?.id ?? 'review-alloc-1',
      idempotencyKey: 'allocation-resolve-1',
      approvalReference: 'allocation-resolve-1',
      expectedCurrentState: { queueState: 'needs_review' },
    }),
  })
  assert.equal(allocationResolved.reviewQueueItem?.queueState, 'closed')

  const serialised = JSON.stringify({
    ...createdDraft,
    ...issuedMonthly,
    ...allocationIssued,
  })
  assert.equal(serialised.includes('sk_live'), false)
  assert.equal(serialised.includes('whsec_'), false)
  assert.equal(serialised.includes('secret'), false)

  console.log('membership support command service tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
