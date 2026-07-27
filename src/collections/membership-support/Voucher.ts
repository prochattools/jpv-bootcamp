import type { CollectionConfig } from 'payload'

import { membershipSupportAccess } from './access'
import { memberRelationship, operatorRelationship, supportRelationship } from './relationships'
import {
  approvalStateOptions,
  fundingSourceOptions,
  membershipSupportGroup,
  voucherDurationOptions,
} from './options'
import { displayNameHookFromFields, normalizeMembershipSupportEmail, normalizeMembershipSupportText } from './hooks'
import { isAllowedVoucherDuration, validateApprovalReferenceForState, validateIssuedStateReferences } from './validation'

export const PayloadMembershipVouchers: CollectionConfig = {
  slug: 'payload_membership_vouchers',
  dbName: 'payload_membership_vouchers',
  labels: {
    singular: 'Voucher',
    plural: 'Vouchers',
  },
  admin: {
    group: membershipSupportGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'member', 'voucherDuration', 'approvalState', 'redemptionState', 'updatedAt'],
    description: 'Voucher templates, issuance, redemption, and deactivation state.',
  },
  access: membershipSupportAccess,
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
      hooks: {
        beforeValidate: [displayNameHookFromFields({ prefix: 'Voucher', fields: [{ name: 'memberEmail' }, { name: 'voucherDuration' }] })],
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
      name: 'voucherDuration',
      type: 'select',
      required: true,
      defaultValue: 'one_month',
      options: voucherDurationOptions,
      validate: (value: unknown) => (isAllowedVoucherDuration(value) ? true : 'Select one month or one year.'),
    },
    {
      name: 'approvalState',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: approvalStateOptions,
    },
    {
      name: 'redemptionState',
      type: 'select',
      required: true,
      defaultValue: 'not_redeemed',
      options: [
        { label: 'Not redeemed', value: 'not_redeemed' },
        { label: 'Redeemed', value: 'redeemed' },
        { label: 'Expired', value: 'expired' },
        { label: 'Deactivated', value: 'deactivated' },
      ],
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
    {
      name: 'stripeCustomerId',
      type: 'text',
      index: true,
    },
    {
      name: 'stripeCouponId',
      type: 'text',
      index: true,
    },
    {
      name: 'stripePromotionCodeId',
      type: 'text',
      index: true,
    },
    {
      name: 'approvalReference',
      type: 'text',
      index: true,
      hooks: {
        beforeValidate: [({ value }) => normalizeMembershipSupportText(value)],
      },
      validate: (value: unknown) => validateApprovalReferenceForState('issued', value),
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
    { name: 'deactivatedAt', type: 'date' },
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

