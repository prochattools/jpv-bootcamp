import type { CollectionConfig } from 'payload'

import { membershipSupportAccess } from './access'
import {
  auditHistoryRelationship,
  fundingSourceRelationship,
  memberRelationship,
  operatorNotesRelationship,
  reconciliationRelationship,
  reviewQueueRelationship,
  stripeShadowRelationship,
  supportRelationship,
  voucherRelationship,
} from './relationships'
import {
  fundingSourceOptions,
  issuanceStateOptions,
  membershipSupportGroup,
  reconciliationStateOptions,
  voucherDurationOptions,
} from './options'
import {
  displayNameHookFromFields,
  normalizeMembershipSupportEmail,
  normalizeMembershipSupportText,
} from './hooks'
import {
  isAllowedFundingSource,
  isAllowedIssuanceState,
  isAllowedReconciliationState,
  isAllowedVoucherDuration,
} from './validation'

export const PayloadMembershipSupportRecords: CollectionConfig = {
  slug: 'payload_membership_support_records',
  dbName: 'payload_membership_support_records',
  labels: {
    singular: 'Membership Support Record',
    plural: 'Membership Support Records',
  },
  admin: {
    group: membershipSupportGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'member', 'fundingSourceType', 'issuanceState', 'reconciliationState', 'updatedAt'],
    description: 'Unified support record for vouchers, pay-it-forward, and membership reconciliation.',
  },
  access: membershipSupportAccess,
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
      hooks: {
        beforeValidate: [displayNameHookFromFields({ prefix: 'Membership support', fields: [{ name: 'memberEmail' }, { name: 'fundingSourceType' }] })],
      },
    },
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
      name: 'fundingSourceType',
      type: 'select',
      required: true,
      defaultValue: 'direct_payment',
      options: fundingSourceOptions,
      validate: (value: unknown) => (isAllowedFundingSource(value) ? true : 'Select a supported funding source.'),
    },
    {
      name: 'voucherDuration',
      type: 'select',
      options: voucherDurationOptions,
      validate: (value: unknown) => (value === undefined || value === null || isAllowedVoucherDuration(value) ? true : 'Select one month or one year.'),
    },
    {
      name: 'issuanceState',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: issuanceStateOptions,
      validate: (value: unknown) => (isAllowedIssuanceState(value) ? true : 'Select a valid issuance state.'),
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
    { name: 'stripeCustomerId', type: 'text', index: true },
    { name: 'stripeSubscriptionId', type: 'text', index: true },
    { name: 'stripePriceId', type: 'text', index: true },
    { name: 'stripeCouponId', type: 'text', index: true },
    { name: 'stripePromotionCodeId', type: 'text', index: true },
    {
      name: 'approvalReference',
      type: 'text',
      index: true,
      hooks: {
        beforeValidate: [({ value }) => normalizeMembershipSupportText(value)],
      },
      validate: (value: unknown) =>
        typeof value === 'string' && value.trim().length > 0 ? true : 'Approval reference is required for issued records.',
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
      name: 'reconciliationState',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: reconciliationStateOptions,
      validate: (value: unknown) => (isAllowedReconciliationState(value) ? true : 'Select a valid reconciliation state.'),
    },
    { name: 'lastWebhookAt', type: 'date' },
    supportRelationship({ hasMany: true }),
    reviewQueueRelationship({ hasMany: true }),
    operatorNotesRelationship({ hasMany: true }),
    auditHistoryRelationship({ hasMany: true }),
    stripeShadowRelationship({ hasMany: true }),
    fundingSourceRelationship({ hasMany: true }),
    { name: 'notes', type: 'textarea' },
    { name: 'metadata', type: 'json', admin: { hidden: true } },
  ],
  timestamps: true,
}
