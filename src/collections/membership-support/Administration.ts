import type { CollectionConfig } from 'payload'

import { membershipSupportAccess } from './access'
import {
  memberRelationship,
  operatorNotesRelationship,
  operatorRelationship,
  reconciliationRelationship,
  reviewQueueRelationship,
  supportRelationship,
  voucherRelationship,
  fundingSourceRelationship,
} from './relationships'
import { membershipSupportGroup, operatorActionOptions, operatorActionStateOptions } from './options'
import { displayNameHookFromFields, normalizeMembershipSupportText } from './hooks'

export const PayloadMembershipAdministrationActions: CollectionConfig = {
  slug: 'payload_membership_administration_actions',
  dbName: 'payload_membership_administration_actions',
  labels: {
    singular: 'Administration Action',
    plural: 'Administration Actions',
  },
  admin: {
    group: membershipSupportGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'actionType', 'actionState', 'operator', 'updatedAt'],
    description: 'Operator actions for membership support, approvals, issuance, and reconciliation.',
  },
  access: membershipSupportAccess,
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
      hooks: {
        beforeValidate: [displayNameHookFromFields({ prefix: 'Administration action', fields: [{ name: 'actionType' }, { name: 'actionState' }] })],
      },
    },
    operatorRelationship({ required: true }),
    memberRelationship(),
    supportRelationship(),
    voucherRelationship(),
    fundingSourceRelationship(),
    reconciliationRelationship(),
    reviewQueueRelationship(),
    {
      name: 'actionType',
      type: 'select',
      required: true,
      options: operatorActionOptions,
    },
    {
      name: 'actionState',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: operatorActionStateOptions,
    },
    {
      name: 'approvalReference',
      type: 'text',
      index: true,
      hooks: {
        beforeValidate: [({ value }) => normalizeMembershipSupportText(value)],
      },
    },
    { name: 'executedAt', type: 'date' },
    { name: 'completedAt', type: 'date' },
    { name: 'failureReason', type: 'textarea' },
    { name: 'notes', type: 'textarea' },
    { name: 'operatorNotes', type: 'relationship', relationTo: 'payload_operator_notes', hasMany: true, index: true },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

