import type { CollectionConfig } from 'payload'

import { membershipSupportAccess } from './access'
import { fundingSourceRelationship, memberRelationship, supportRelationship, voucherRelationship } from './relationships'
import { membershipSupportGroup, shadowStateOptions } from './options'
import { displayNameHookFromFields, normalizeMembershipSupportText } from './hooks'

export const PayloadStripeShadowProjections: CollectionConfig = {
  slug: 'payload_stripe_shadow_projections',
  dbName: 'payload_stripe_shadow_projections',
  labels: {
    singular: 'Stripe Shadow Projection',
    plural: 'Stripe Shadow Projections',
  },
  admin: {
    hidden: true,
    group: membershipSupportGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'shadowState', 'member', 'lastWebhookAt', 'updatedAt'],
    description: 'Billing state snapshot used for reconciliation and audit.',
  },
  access: membershipSupportAccess,
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
      hooks: {
        beforeValidate: [displayNameHookFromFields({ prefix: 'Stripe shadow', fields: [{ name: 'shadowState' }, { name: 'stripeEventId' }] })],
      },
    },
    supportRelationship(),
    voucherRelationship(),
    fundingSourceRelationship(),
    memberRelationship(),
    {
      name: 'stripeCustomerId',
      type: 'text',
      index: true,
    },
    {
      name: 'stripeSubscriptionId',
      type: 'text',
      index: true,
    },
    {
      name: 'stripePriceId',
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
      name: 'stripeInvoiceId',
      type: 'text',
      index: true,
    },
    {
      name: 'stripeEventId',
      type: 'text',
      index: true,
    },
    {
      name: 'shadowState',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: shadowStateOptions,
    },
    { name: 'lastWebhookAt', type: 'date' },
    { name: 'shadowedAt', type: 'date' },
    {
      name: 'observedStatus',
      type: 'text',
    },
    {
      name: 'notes',
      type: 'textarea',
      hooks: {
        beforeValidate: [({ value }) => normalizeMembershipSupportText(value)],
      },
    },
    { name: 'metadata', type: 'json', admin: { hidden: true } },
  ],
  timestamps: true,
}
