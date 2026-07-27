import type { CollectionConfig } from 'payload'

import { membershipSupportAccess } from './access'
import { fundingSourceRelationship, memberRelationship, reconciliationRelationship, supportRelationship, voucherRelationship } from './relationships'
import { membershipSupportGroup, queueReasonOptions, queueStateOptions } from './options'
import { displayNameHookFromFields, normalizeMembershipSupportText } from './hooks'

export const PayloadMembershipReviewQueueItems: CollectionConfig = {
  slug: 'payload_membership_review_queue_items',
  dbName: 'payload_membership_review_queue_items',
  labels: {
    singular: 'Review Queue Item',
    plural: 'Review Queue Items',
  },
  admin: {
    group: membershipSupportGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'queueState', 'queueReason', 'priority', 'assignedTo', 'updatedAt'],
    description: 'Review queue for approvals, mismatches, and manual operator follow-up.',
  },
  access: membershipSupportAccess,
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
      hooks: {
        beforeValidate: [displayNameHookFromFields({ prefix: 'Review queue item', fields: [{ name: 'queueState' }, { name: 'queueReason' }] })],
      },
    },
    supportRelationship(),
    voucherRelationship(),
    fundingSourceRelationship(),
    reconciliationRelationship(),
    memberRelationship(),
    {
      name: 'queueState',
      type: 'select',
      required: true,
      defaultValue: 'needs_review',
      options: queueStateOptions,
    },
    {
      name: 'queueReason',
      type: 'select',
      required: true,
      defaultValue: 'approval_required',
      options: queueReasonOptions,
    },
    {
      name: 'priority',
      type: 'number',
      required: true,
      defaultValue: 100,
      min: 0,
    },
    {
      name: 'assignedTo',
      type: 'relationship',
      relationTo: 'payload_users',
      index: true,
    },
    { name: 'dueAt', type: 'date' },
    { name: 'resolvedAt', type: 'date' },
    { name: 'notes', type: 'textarea' },
    { name: 'metadata', type: 'json', admin: { hidden: true } },
  ],
  timestamps: true,
}

