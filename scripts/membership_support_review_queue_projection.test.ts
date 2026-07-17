import assert from 'node:assert/strict'

import { buildMembershipSupportReviewQueueProjection } from '../src/lib/membership-support/workflows'

function run(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`fail - ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

const now = new Date('2026-07-17T00:00:00.000Z')

run('projects voucher approval queues deterministically', () => {
  const projection = buildMembershipSupportReviewQueueProjection({
    action: 'voucher_submit_for_approval',
    targetId: 'voucher-1',
    reason: 'approval_required',
    notes: 'Approve voucher for cus_123 and sub_456.',
    approvalReference: 'approval-1',
    now,
    metadata: { memberId: 'member-1', sourceEventId: 'evt_123' },
  })

  assert.equal(projection.queueType, 'voucher_approval')
  assert.equal(projection.priority, 50)
  assert.match(projection.dedupeKey, /^review_[a-f0-9]{64}$/)
  assert.equal(projection.membershipSupportReference, 'voucher-1')
  assert.equal(projection.memberReference, 'member-1')
  assert.equal(projection.sourceEventId, 'evt_123')
  assert.equal(projection.requiredAction, 'review voucher approval request')
  assert.doesNotMatch(projection.evidenceSummary, /cus_123|sub_456/)
})

run('projects pay-it-forward approvals and webhook mismatches', () => {
  const approval = buildMembershipSupportReviewQueueProjection({
    action: 'pay_it_forward_allocation_submitted',
    targetId: 'allocation-1',
    reason: 'approval_required',
    notes: 'Review allocation.',
    approvalReference: 'approval-2',
    now,
    metadata: { migrationCandidateReference: 'candidate-1' },
  })
  const mismatch = buildMembershipSupportReviewQueueProjection({
    action: 'webhook_customer_subscription_updated',
    targetId: 'support-1',
    reason: 'webhook_mismatch',
    notes: 'Stripe price mismatch for price_789.',
    approvalReference: 'approval-3',
    now,
    metadata: { sourceEventId: 'evt_456' },
  })

  assert.equal(approval.queueType, 'pay_it_forward_approval')
  assert.equal(approval.requiredAction, 'review pay-it-forward approval request')
  assert.equal(mismatch.queueType, 'webhook_reconciliation_mismatch')
  assert.equal(mismatch.priority, 20)
  assert.doesNotMatch(mismatch.evidenceSummary, /price_789/)
})

run('projects migration review and stale-event conflict distinctly', () => {
  const migration = buildMembershipSupportReviewQueueProjection({
    action: 'voucher_projection_review_routed',
    targetId: 'projection-1',
    reason: 'webhook_mismatch',
    notes: 'Migration preview mismatch for customer cus_999.',
    approvalReference: 'approval-4',
    now,
    metadata: { migrationCandidateReference: 'candidate-2' },
  })
  const stale = buildMembershipSupportReviewQueueProjection({
    action: 'voucher_projection_issued',
    targetId: 'projection-2',
    reason: 'idempotency_conflict',
    notes: 'Replay conflict detected.',
    approvalReference: 'approval-5',
    now,
  })

  assert.equal(migration.queueType, 'migration_preview_mismatch')
  assert.equal(migration.requiredAction, 'review migration preview mismatch')
  assert.equal(stale.queueType, 'stale_event_conflict')
  assert.equal(stale.priority, 10)
  assert.equal(stale.status, 'open')
})

