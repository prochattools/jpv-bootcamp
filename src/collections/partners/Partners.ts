import type { CollectionConfig } from 'payload'

import { adminOnlyCollectionAccess } from '@/lib/access/payloadAccess'

const partnerGroup = 'Partners'

const partnerStatusOptions = [
  { label: 'Draft', value: 'draft' },
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
  { label: 'Archived', value: 'archived' },
]

const applicationModeOptions = [
  { label: 'Redirect', value: 'redirect' },
  { label: 'Email', value: 'email' },
  { label: 'Webhook', value: 'webhook' },
  { label: 'Manual Export', value: 'manual_export' },
]

const deliveryStatusOptions = [
  { label: 'Submitted', value: 'submitted' },
  { label: 'Delivery Pending', value: 'delivery_pending' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Delivery Failed', value: 'delivery_failed' },
]

export const PayloadPartnerAffiliates: CollectionConfig = {
  slug: 'payload_partner_affiliates' as never,
  dbName: 'payload_partner_affiliates',
  labels: { singular: 'Partner Affiliate', plural: 'Partner Affiliates' },
  admin: {
    group: partnerGroup,
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'status', 'applicationMode', 'updatedAt'],
    description: 'External partner organizations and destinations: profiles, recipient emails, trusted destinations, webhook rules, and public partner application handoff.',
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: partnerStatusOptions,
    },
    { name: 'category', type: 'text', required: true },
    { name: 'summary', type: 'textarea' },
    { name: 'logo', type: 'text' },
    {
      name: 'applicationMode',
      type: 'select',
      required: true,
      defaultValue: 'redirect',
      options: applicationModeOptions,
    },
    { name: 'affiliateUrl', type: 'text' },
    { name: 'recipientEmails', type: 'array', fields: [{ name: 'email', type: 'email', required: true }] },
    { name: 'webhookEndpoint', type: 'text' },
    { name: 'requiredFields', type: 'json' },
    { name: 'privacyNotice', type: 'textarea' },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
    { name: 'externalReference', type: 'text', index: true },
    { name: 'metadata', type: 'json', admin: { hidden: true } },
  ],
  timestamps: true,
}

export const PayloadPartnerApplications: CollectionConfig = {
  slug: 'payload_partner_applications' as never,
  dbName: 'payload_partner_applications',
  labels: { singular: 'Partner Application', plural: 'Partner Applications' },
  admin: {
    group: partnerGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'partner', 'member', 'status', 'deliveryMethod', 'updatedAt'],
    description: 'Public partner application history, delivery state, retries, export readiness, and operations handoff.',
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'displayName', type: 'text', required: true },
    { name: 'member', type: 'relationship', relationTo: 'payload_members' as never, required: true, index: true },
    { name: 'partner', type: 'relationship', relationTo: 'payload_partner_affiliates' as never, required: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'submitted',
      options: deliveryStatusOptions,
    },
    { name: 'submittedAt', type: 'date' },
    { name: 'deliveredAt', type: 'date' },
    { name: 'applicationReference', type: 'text', unique: true, index: true },
    { name: 'memberNameSnapshot', type: 'text' },
    { name: 'memberEmailSnapshot', type: 'email' },
    { name: 'memberPhoneSnapshot', type: 'text' },
    { name: 'partnerSlugSnapshot', type: 'text', index: true },
    { name: 'partnerNameSnapshot', type: 'text' },
    { name: 'companySnapshot', type: 'text' },
    { name: 'countrySnapshot', type: 'text' },
    { name: 'experienceSnapshot', type: 'text' },
    { name: 'messageSnapshot', type: 'textarea' },
    { name: 'consentAcceptedAt', type: 'date' },
    {
      name: 'deliveryMethod',
      type: 'select',
      required: true,
      defaultValue: 'redirect',
      options: applicationModeOptions,
    },
    { name: 'deliveryAttempts', type: 'number', required: true, defaultValue: 0, min: 0 },
    { name: 'lastDeliveryError', type: 'textarea' },
    { name: 'trustedDestinationSnapshot', type: 'text' },
    { name: 'source', type: 'text', defaultValue: 'portal' },
    { name: 'sourceMemberId', type: 'number' },
    { name: 'legacyReference', type: 'text' },
    { name: 'internalNotes', type: 'textarea' },
    { name: 'metadata', type: 'json', admin: { hidden: true } },
  ],
  timestamps: true,
}

export const PayloadPartnerEvents: CollectionConfig = {
  slug: 'payload_partner_events' as never,
  dbName: 'payload_partner_events',
  labels: { singular: 'Partner Event', plural: 'Partner Events' },
  admin: {
    group: partnerGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'eventType', 'partner', 'application', 'createdAt'],
    description: 'Partner delivery and application event history for external partner operations.',
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'displayName', type: 'text', required: true },
    { name: 'partner', type: 'relationship', relationTo: 'payload_partner_affiliates' as never, index: true },
    { name: 'application', type: 'relationship', relationTo: 'payload_partner_applications' as never, index: true },
    { name: 'member', type: 'relationship', relationTo: 'payload_members' as never, index: true },
    { name: 'eventType', type: 'text', required: true, index: true },
    { name: 'sourceRoute', type: 'text' },
    { name: 'status', type: 'text' },
    { name: 'deliveryMethod', type: 'select', options: applicationModeOptions },
    { name: 'attempt', type: 'number', min: 0 },
    { name: 'deliveryError', type: 'textarea' },
    { name: 'metadata', type: 'json', admin: { hidden: true } },
  ],
  timestamps: true,
}
