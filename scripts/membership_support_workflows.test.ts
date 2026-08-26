import assert from 'node:assert/strict'

import { InMemoryMembershipSupportStripeAdapter } from '@/lib/membership-support/stripeAdapter'
import {
  approvePayItForwardAllocation,
  approveVoucher,
  createDraftVoucher,
  createPayItForwardAllocation,
  deactivateUnusedVoucher,
  expireVoucher,
  issuePayItForwardVoucherProjection,
  issueVoucherProjection,
  InMemoryMembershipSupportWorkflowJournal,
  type MembershipSupportPayItForwardAllocationRecord,
  type MembershipSupportVoucherRecord,
  type WorkflowResult,
  type WorkflowSuccess,
} from '@/lib/membership-support/workflows'

function now(value = '2026-07-17T00:00:00.000Z'): Date {
  return new Date(value)
}

function workflowContext(overrides: Partial<{ operatorId: string; approvalReference: string; now: Date }> = {}) {
  return {
    operatorId: overrides.operatorId ?? 'operator-1',
    approvalReference: overrides.approvalReference ?? 'approval-1',
    now: overrides.now ?? now(),
  }
}

function voucherInput(overrides: Partial<Parameters<typeof createDraftVoucher>[1]> = {}) {
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

function allocationInput(overrides: Partial<Parameters<typeof createPayItForwardAllocation>[1]> = {}) {
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
    reason: 'Pay-it-forward allocation created',
    notes: 'Sponsored by donor',
    metadata: { channel: 'admin' },
    ...overrides,
  }
}

function ensureSuccess<T>(result: WorkflowResult<T>): asserts result is WorkflowSuccess<T> {
  assert.equal(result.ok, true)
}

async function main(): Promise<void> {
  const journal = new InMemoryMembershipSupportWorkflowJournal()
  const adapter = new InMemoryMembershipSupportStripeAdapter()
  adapter.seedSubscription({ id: 'sub_1', customerId: 'cus_1', priceId: 'price_monthly', status: 'active' })

  const draft = createDraftVoucher(journal, voucherInput(), workflowContext())
  ensureSuccess(draft)
  assert.equal(draft.value.voucher.approvalState, 'draft')
  assert.equal(draft.auditEvent.action, 'voucher_draft_created')
  assert.equal(Object.isFrozen(draft.auditEvent), true)

  const draftRetry = createDraftVoucher(journal, voucherInput(), workflowContext())
  ensureSuccess(draftRetry)
  assert.equal(draftRetry.value.voucher.id, draft.value.voucher.id)
  assert.equal(draftRetry.auditEvent.id, draft.auditEvent.id)

  const approved = approveVoucher(journal, draft.value.voucher, workflowContext({ approvalReference: 'approval-2' }))
  ensureSuccess(approved)
  assert.equal(approved.value.voucher.approvalState, 'approved')
  assert.equal(approved.value.voucher.approvedBy, 'operator-1')

  const issued = await issueVoucherProjection(journal, approved.value.voucher, workflowContext({ approvalReference: 'approval-3' }), adapter)
  ensureSuccess(issued)
  assert.equal(issued.value.voucher.approvalState, 'issued')
  assert.equal(issued.value.projection.fundingSource, 'voucher')
  assert.equal(issued.value.projection.reconciliationState, 'matched')
  assert.equal(issued.value.voucher.stripePromotionCodeId?.startsWith('promo_'), true)

  const annualDraft = createDraftVoucher(
    journal,
    voucherInput({
      id: 'voucher-2',
      voucherDuration: 'one_year',
      billingCadence: 'annual',
      stripeCustomerId: 'cus_1',
    }),
    workflowContext({ approvalReference: 'approval-4' }),
  )
  ensureSuccess(annualDraft)
  const annualApproved = approveVoucher(journal, annualDraft.value.voucher, workflowContext({ approvalReference: 'approval-5' }))
  ensureSuccess(annualApproved)
  const annualIssued = await issueVoucherProjection(journal, annualApproved.value.voucher, workflowContext({ approvalReference: 'approval-6' }), adapter)
  ensureSuccess(annualIssued)
  assert.equal(annualIssued.value.projection.voucherDuration, 'one_year')
  assert.equal(annualIssued.value.projection.billingCadence, 'annual')

  const directSponsoredAttempt = await issueVoucherProjection(
    journal,
    {
      ...annualIssued.value.voucher,
      id: 'voucher-direct',
      fundingSource: 'direct_payment' as never,
    } as MembershipSupportVoucherRecord,
    workflowContext({ approvalReference: 'approval-7' }),
    adapter,
  )
  assert.equal(directSponsoredAttempt.ok, false)
  assert.equal(directSponsoredAttempt.error, 'direct_sponsored_access_not_allowed')
  assert.equal(directSponsoredAttempt.reviewQueueItem.queueReason, 'manual_override')

  const deactivated = deactivateUnusedVoucher(journal, approved.value.voucher, workflowContext({ approvalReference: 'approval-8' }))
  ensureSuccess(deactivated)
  assert.equal(deactivated.value.voucher.redemptionState, 'deactivated')

  const expiredJournal = new InMemoryMembershipSupportWorkflowJournal()
  const expiredDraft = createDraftVoucher(expiredJournal, voucherInput({ id: 'voucher-expire' }), workflowContext({ approvalReference: 'approval-9' }))
  ensureSuccess(expiredDraft)
  const expiredApproved = approveVoucher(expiredJournal, expiredDraft.value.voucher, workflowContext({ approvalReference: 'approval-10' }))
  ensureSuccess(expiredApproved)
  const expired = expireVoucher(expiredJournal, expiredApproved.value.voucher, workflowContext({ approvalReference: 'approval-11' }))
  ensureSuccess(expired)
  assert.equal(expired.value.voucher.redemptionState, 'expired')

  assert.throws(() => {
    void issueVoucherProjection(journal, approved.value.voucher, workflowContext({ approvalReference: '' }), adapter)
  }, /approval_reference_required/)
  assert.throws(
    () => createDraftVoucher(journal, voucherInput({ id: 'voucher-no-operator' }), workflowContext({ operatorId: '' })),
    /operator_required/,
  )

  const mismatchJournal = new InMemoryMembershipSupportWorkflowJournal()
  const mismatchAdapter = new InMemoryMembershipSupportStripeAdapter()
  mismatchAdapter.seedSubscription({ id: 'sub_1', customerId: 'cus_other', priceId: 'price_monthly', status: 'active' })
  const mismatchDraft = createDraftVoucher(mismatchJournal, voucherInput({ id: 'voucher-mismatch' }), workflowContext({ approvalReference: 'approval-12' }))
  ensureSuccess(mismatchDraft)
  const mismatchApproved = approveVoucher(mismatchJournal, mismatchDraft.value.voucher, workflowContext({ approvalReference: 'approval-13' }))
  ensureSuccess(mismatchApproved)
  const mismatch = await issueVoucherProjection(mismatchJournal, mismatchApproved.value.voucher, workflowContext({ approvalReference: 'approval-14' }), mismatchAdapter)
  assert.equal(mismatch.ok, false)
  assert.equal(mismatch.error, 'webhook_mismatch')
  assert.equal(mismatch.reviewQueueItem.queueReason, 'webhook_mismatch')

  const allocationDraft = createPayItForwardAllocation(journal, allocationInput({ id: 'allocation-1' }), workflowContext({ approvalReference: 'approval-15' }))
  ensureSuccess(allocationDraft)
  const allocationApproved = approvePayItForwardAllocation(journal, allocationDraft.value.allocation, workflowContext({ approvalReference: 'approval-16' }))
  ensureSuccess(allocationApproved)
  const allocationIssued = await issuePayItForwardVoucherProjection(
    journal,
    allocationApproved.value.allocation,
    workflowContext({ approvalReference: 'approval-17' }),
    adapter,
  )
  ensureSuccess(allocationIssued)
  assert.equal(allocationIssued.value.projection.fundingSource, 'pay_it_forward')
  assert.equal(allocationIssued.value.allocation.approvalState, 'issued')

  const allocationRetry = await issuePayItForwardVoucherProjection(
    journal,
    allocationApproved.value.allocation,
    workflowContext({ approvalReference: 'approval-17' }),
    adapter,
  )
  ensureSuccess(allocationRetry)
  assert.equal(allocationRetry.value.projection.id, allocationIssued.value.projection.id)

  const snapshot = journal.snapshot()
  assert.ok(snapshot.auditHistory.length >= 8)
  assert.ok(snapshot.reviewQueue.length >= 1)
  assert.ok(snapshot.reviewQueue.some((item) => item.queueReason === 'manual_override'))

  const mismatchSnapshot = mismatchJournal.snapshot()
  assert.ok(mismatchSnapshot.reviewQueue.some((item) => item.queueReason === 'webhook_mismatch'))

  const serialised = JSON.stringify(snapshot)
  assert.equal(serialised.includes('sk_live'), false)
  assert.equal(serialised.includes('whsec_'), false)
  assert.equal(serialised.includes('secret'), false)

  console.log('membership support workflow tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
