import assert from 'node:assert/strict'

import {
  membershipSupportCollections,
  PayloadMembershipSupportRecords,
  PayloadMembershipVouchers,
  PayloadPayItForwardFunding,
  PayloadMembershipFundingSources,
  PayloadMembershipReconciliations,
  PayloadMembershipAdministrationActions,
  PayloadMembershipReviewQueueItems,
  PayloadOperatorNotes,
  PayloadStripeShadowProjections,
  PayloadMembershipAuditHistory,
} from '@/collections/membership-support'

function main(): void {
  const expected = [
    'payload_membership_support_records',
    'payload_membership_vouchers',
    'payload_pay_it_forward_funding',
    'payload_membership_funding_sources',
    'payload_membership_reconciliations',
    'payload_membership_administration_actions',
    'payload_membership_review_queue_items',
    'payload_operator_notes',
    'payload_stripe_shadow_projections',
    'payload_membership_audit_history',
  ]

  assert.equal(membershipSupportCollections.length, expected.length)
  assert.deepEqual(
    membershipSupportCollections.map((collection) => collection.slug),
    expected,
  )

  const first = PayloadMembershipSupportRecords
  assert.equal(first.admin?.group, 'Membership Support')
  assert.equal(first.admin?.useAsTitle, 'displayName')
  assert.equal(first.labels?.singular, 'Membership Support Record')

  assert.equal(PayloadMembershipVouchers.admin?.group, 'Membership Support')
  assert.equal(PayloadPayItForwardFunding.admin?.group, 'Membership Support')
  assert.equal(PayloadMembershipFundingSources.admin?.group, 'Membership Support')
  assert.equal(PayloadMembershipReconciliations.admin?.group, 'Membership Support')
  assert.equal(PayloadMembershipAdministrationActions.admin?.group, 'Membership Support')
  assert.equal(PayloadMembershipReviewQueueItems.admin?.group, 'Membership Support')
  assert.equal(PayloadOperatorNotes.admin?.group, 'Membership Support')
  assert.equal(PayloadStripeShadowProjections.admin?.group, 'Membership Support')
  assert.equal(PayloadMembershipAuditHistory.admin?.group, 'Membership Support')

  console.log('membership support collection registry tests passed')
}

main()
