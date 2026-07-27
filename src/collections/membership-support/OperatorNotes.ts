import type { CollectionConfig } from 'payload'

import { membershipSupportAccess } from './access'
import { auditHistoryRelationship, fundingSourceRelationship, reconciliationRelationship, supportRelationship, voucherRelationship } from './relationships'
import { membershipSupportGroup, noteTargetTypeOptions, noteVisibilityOptions } from './options'
import { displayNameHookFromFields, normalizeMembershipSupportText } from './hooks'

export const PayloadOperatorNotes: CollectionConfig = {
  slug: 'payload_operator_notes',
  dbName: 'payload_operator_notes',
  labels: {
    singular: 'Operator Note',
    plural: 'Operator Notes',
  },
  admin: {
    group: membershipSupportGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'targetType', 'visibility', 'author', 'updatedAt'],
    description: 'Internal operator notes for support, voucher, and reconciliation workflows.',
  },
  access: membershipSupportAccess,
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
      hooks: {
        beforeValidate: [displayNameHookFromFields({ prefix: 'Operator note', fields: [{ name: 'targetType' }, { name: 'visibility' }] })],
      },
    },
    {
      name: 'targetType',
      type: 'select',
      required: true,
      defaultValue: 'membership_support',
      options: noteTargetTypeOptions,
    },
    {
      name: 'targetId',
      type: 'text',
      required: true,
      index: true,
    },
    {
      name: 'visibility',
      type: 'select',
      required: true,
      defaultValue: 'internal',
      options: noteVisibilityOptions,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'payload_users',
      required: true,
      index: true,
    },
    supportRelationship(),
    voucherRelationship(),
    fundingSourceRelationship(),
    reconciliationRelationship(),
    auditHistoryRelationship(),
    {
      name: 'note',
      type: 'textarea',
      required: true,
      hooks: {
        beforeValidate: [({ value }) => normalizeMembershipSupportText(value)],
      },
    },
    { name: 'pinned', type: 'checkbox', defaultValue: false },
    { name: 'metadata', type: 'json', admin: { hidden: true } },
  ],
  timestamps: true,
}

