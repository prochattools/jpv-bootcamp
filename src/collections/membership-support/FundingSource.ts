import type { CollectionConfig } from 'payload'

import { membershipSupportAccess } from './access'
import { memberRelationship, operatorRelationship, supportRelationship, voucherRelationship } from './relationships'
import { membershipSupportGroup } from './options'
import { displayNameHookFromFields, normalizeMembershipSupportText } from './hooks'
import { isAllowedFundingSource } from './validation'

export const PayloadMembershipFundingSources: CollectionConfig = {
  slug: 'payload_membership_funding_sources',
  dbName: 'payload_membership_funding_sources',
  labels: {
    singular: 'Funding Source',
    plural: 'Funding Sources',
  },
  admin: {
    group: membershipSupportGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'sourceType', 'sourceState', 'member', 'updatedAt'],
    description: 'Canonical funding source records for membership support and sponsorship.',
  },
  access: membershipSupportAccess,
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
      hooks: {
        beforeValidate: [displayNameHookFromFields({ prefix: 'Funding source', fields: [{ name: 'sourceType' }, { name: 'sourceState' }] })],
      },
    },
    supportRelationship(),
    voucherRelationship(),
    memberRelationship(),
    {
      name: 'sourceType',
      type: 'select',
      required: true,
      defaultValue: 'direct_payment',
      options: [
        { label: 'Direct payment', value: 'direct_payment' },
        { label: 'Voucher', value: 'voucher' },
        { label: 'Pay it forward', value: 'pay_it_forward' },
      ],
      validate: (value: unknown) => (isAllowedFundingSource(value) ? true : 'Select a supported funding source.'),
    },
    {
      name: 'sourceState',
      type: 'select',
      required: true,
      defaultValue: 'planned',
      options: [
        { label: 'Planned', value: 'planned' },
        { label: 'Approved', value: 'approved' },
        { label: 'Allocated', value: 'allocated' },
        { label: 'Depleted', value: 'depleted' },
        { label: 'Revoked', value: 'revoked' },
      ],
    },
    {
      name: 'committedAmountMinor',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'availableAmountMinor',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'currency',
      type: 'text',
      required: true,
      defaultValue: 'GBP',
    },
    {
      name: 'donorName',
      type: 'text',
    },
    {
      name: 'approvalReference',
      type: 'text',
      index: true,
      hooks: {
        beforeValidate: [({ value }) => normalizeMembershipSupportText(value)],
      },
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
    { name: 'depletedAt', type: 'date' },
    { name: 'notes', type: 'textarea' },
    { name: 'metadata', type: 'json', admin: { hidden: true } },
  ],
  timestamps: true,
}

