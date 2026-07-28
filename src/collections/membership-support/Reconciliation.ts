import type { CollectionConfig } from 'payload'

import { membershipSupportAccess } from './access'
import { fundingSourceRelationship, memberRelationship, supportRelationship, voucherRelationship } from './relationships'
import { membershipSupportGroup, reconciliationStateOptions } from './options'
import { displayNameHookFromFields, normalizeMembershipSupportText } from './hooks'
import { isAllowedReconciliationState } from './validation'

export const PayloadMembershipReconciliations: CollectionConfig = {
  slug: 'payload_membership_reconciliations',
  dbName: 'payload_membership_reconciliations',
  labels: {
    singular: 'Reconciliation',
    plural: 'Reconciliations',
  },
  admin: {
    group: membershipSupportGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'reconciliationState', 'member', 'lastWebhookAt', 'updatedAt'],
    description: 'Membership billing reconciliation results and status history.',
  },
  access: membershipSupportAccess,
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
      hooks: {
        beforeValidate: [displayNameHookFromFields({ prefix: 'Reconciliation', fields: [{ name: 'reconciliationState' }, { name: 'stripeEventType' }] })],
      },
    },
    supportRelationship(),
    voucherRelationship(),
    fundingSourceRelationship(),
    memberRelationship(),
    {
      name: 'stripeEventId',
      type: 'text',
      index: true,
    },
    {
      name: 'stripeEventType',
      type: 'text',
      required: true,
    },
    {
      name: 'reconciliationState',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: reconciliationStateOptions,
      validate: (value: unknown) => (isAllowedReconciliationState(value) ? true : 'Select a valid reconciliation state.'),
    },
    {
      name: 'failureCode',
      type: 'text',
      index: true,
    },
    { name: 'lastWebhookAt', type: 'date' },
    { name: 'resolvedAt', type: 'date' },
    { name: 'notes', type: 'textarea' },
    { name: 'metadata', type: 'json', admin: { hidden: true } },
  ],
  timestamps: true,
}

