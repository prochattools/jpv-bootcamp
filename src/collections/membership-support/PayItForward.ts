import type { CollectionConfig } from 'payload'

import { membershipSupportAccess } from './access'
import { memberRelationship, operatorRelationship, supportRelationship } from './relationships'
import {
  approvalStateOptions,
  membershipSupportGroup,
} from './options'
import { displayNameHookFromFields, normalizeMembershipSupportEmail, normalizeMembershipSupportText } from './hooks'

export const PayloadPayItForwardFunding: CollectionConfig = {
  slug: 'payload_pay_it_forward_funding',
  dbName: 'payload_pay_it_forward_funding',
  labels: {
    singular: 'Pay It Forward Funding',
    plural: 'Pay It Forward Funding',
  },
  admin: {
    group: membershipSupportGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'member', 'approvalState', 'billingCadence', 'updatedAt'],
    description: 'Funding allocations for pay-it-forward sponsored membership.',
  },
  access: membershipSupportAccess,
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
      hooks: {
        beforeValidate: [displayNameHookFromFields({ prefix: 'Pay it forward', fields: [{ name: 'memberEmail' }, { name: 'approvalState' }] })],
      },
    },
    supportRelationship({ required: true }),
    memberRelationship({ required: true }),
    {
      name: 'memberEmail',
      type: 'email',
      required: true,
      index: true,
      hooks: {
        beforeValidate: [({ value }) => normalizeMembershipSupportEmail(value)],
      },
    },
    {
      name: 'donorName',
      type: 'text',
      required: true,
    },
    {
      name: 'approvalState',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: approvalStateOptions,
    },
    {
      name: 'billingCadence',
      type: 'select',
      required: true,
      defaultValue: 'monthly',
      options: [
        { label: 'Monthly', value: 'monthly' },
        { label: 'Annual', value: 'annual' },
      ],
    },
    { name: 'allocatedAmountMinor', type: 'number', required: true, min: 0 },
    {
      name: 'currency',
      type: 'text',
      required: true,
      defaultValue: 'GBP',
    },
    { name: 'stripeCustomerId', type: 'text', index: true },
    { name: 'stripeCouponId', type: 'text', index: true },
    { name: 'stripePromotionCodeId', type: 'text', index: true },
    { name: 'stripeSubscriptionId', type: 'text', index: true },
    {
      name: 'approvalReference',
      type: 'text',
      index: true,
      hooks: {
        beforeValidate: [({ value }) => normalizeMembershipSupportText(value)],
      },
      required: true,
    },
    {
      name: 'issuedBy',
      type: 'relationship',
      relationTo: 'payload_users',
      index: true,
    },
    {
      name: 'approvedBy',
      type: 'relationship',
      relationTo: 'payload_users',
      index: true,
    },
    { name: 'issuedAt', type: 'date' },
    { name: 'expiresAt', type: 'date' },
    { name: 'redeemedAt', type: 'date' },
    { name: 'revokedAt', type: 'date' },
    {
      name: 'reason',
      type: 'textarea',
      required: true,
    },
    { name: 'operatorNotes', type: 'relationship', relationTo: 'payload_operator_notes', hasMany: true, index: true },
    { name: 'metadata', type: 'json', admin: { hidden: true } },
  ],
  timestamps: true,
}

