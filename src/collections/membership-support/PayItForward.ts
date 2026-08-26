import type { CollectionConfig } from 'payload'

import { membershipSupportAccess } from './access'
import { memberRelationship, operatorRelationship, supportRelationship } from './relationships'
import {
  approvalStateOptions,
  membershipSupportGroup,
} from './options'
import { displayNameHookFromFields, normalizeMembershipSupportEmail, normalizeMembershipSupportText } from './hooks'

const seatStatusOptions = [
  { label: 'Available', value: 'available' },
  { label: 'Reserved', value: 'reserved' },
  { label: 'Redeemed', value: 'redeemed' },
]

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
    defaultColumns: ['displayName', 'seatStatus', 'sponsorEmail', 'purchasedAt', 'approvalState', 'updatedAt'],
    description: 'Pay-it-forward sponsored seat purchases and funding allocations.',
    components: {
      afterList: ['./components/payload/PayItForwardAdminQueue#default'],
    },
  },
  access: membershipSupportAccess,
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
      hooks: {
        beforeValidate: [displayNameHookFromFields({ prefix: 'Pay it forward', fields: [{ name: 'sponsorEmail' }, { name: 'memberEmail' }, { name: 'approvalState' }] })],
      },
    },

    // --- Sponsored seat tracking (auto-populated from Stripe) ---
    {
      name: 'sponsorEmail',
      type: 'email',
      label: 'Sponsor email',
      index: true,
    },
    {
      name: 'stripeCheckoutSessionId',
      type: 'text',
      label: 'Stripe checkout session ID',
      index: true,
    },
    {
      name: 'stripePaymentIntentId',
      type: 'text',
      label: 'Stripe payment intent ID',
      index: true,
    },
    {
      name: 'amountPaidMinor',
      type: 'number',
      label: 'Amount paid (minor units)',
      admin: {
        description: 'Amount paid in minor currency units (e.g. 8000 = £80.00).',
      },
    },
    {
      name: 'purchasedAt',
      type: 'date',
      label: 'Purchased at',
      index: true,
    },
    {
      name: 'seatStatus',
      type: 'select',
      label: 'Seat status',
      defaultValue: 'available',
      options: seatStatusOptions,
      index: true,
    },
    {
      name: 'redeemedByName',
      type: 'text',
      label: 'Redeemed by (name)',
    },
    {
      name: 'redeemedByEmail',
      type: 'email',
      label: 'Redeemed by (email)',
      index: true,
    },

    // --- Legacy subscription-based fields (optional for manual workflows) ---
    supportRelationship({ required: false }),
    memberRelationship({ required: false }),
    {
      name: 'memberEmail',
      type: 'email',
      index: true,
      hooks: {
        beforeValidate: [({ value }) => normalizeMembershipSupportEmail(value)],
      },
    },
    {
      name: 'donorName',
      type: 'text',
    },
    {
      name: 'approvalState',
      type: 'select',
      defaultValue: 'draft',
      options: approvalStateOptions,
    },
    {
      name: 'billingCadence',
      type: 'select',
      defaultValue: 'monthly',
      options: [
        { label: 'Monthly', value: 'monthly' },
        { label: 'Annual', value: 'annual' },
      ],
    },
    { name: 'allocatedAmountMinor', type: 'number', min: 0 },
    {
      name: 'currency',
      type: 'text',
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
    },
    { name: 'operatorNotes', type: 'relationship', relationTo: 'payload_operator_notes', hasMany: true, index: true },
    { name: 'metadata', type: 'json', admin: { hidden: true } },
  ],
  timestamps: true,
}
