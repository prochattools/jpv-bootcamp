import type { CollectionConfig } from 'payload'

import { adminOnlyCollectionAccess } from '@/lib/access/payloadAccess'

const affiliateGroup = 'Partners & Affiliates'

function normalizeCurrency(value: unknown): string | null | undefined {
  if (value == null || value === '') return value as null | undefined
  if (typeof value !== 'string') return value as never
  return value.trim().toUpperCase()
}

export const PayloadAffiliates: CollectionConfig = {
  slug: 'payload_affiliates',
  dbName: 'payload_affiliates',
  labels: {
    singular: 'Affiliate',
    plural: 'Affiliates',
  },
  admin: {
    group: affiliateGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'member', 'referralCode', 'status', 'updatedAt'],
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'displayName', type: 'text', required: true },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'referralCode',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Active', value: 'active' },
        { label: 'Suspended', value: 'suspended' },
      ],
    },
  ],
  timestamps: true,
}

export const PayloadAffiliateReferrals: CollectionConfig = {
  slug: 'payload_affiliate_referrals',
  dbName: 'payload_affiliate_referrals',
  labels: {
    singular: 'Affiliate Referral',
    plural: 'Affiliate Referrals',
  },
  admin: {
    group: affiliateGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'affiliate', 'referredMember', 'status', 'convertedAt'],
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'displayName', type: 'text', required: true },
    {
      name: 'affiliate',
      type: 'relationship',
      relationTo: 'payload_affiliates',
      required: true,
      index: true,
    },
    {
      name: 'referredMember',
      type: 'relationship',
      relationTo: 'payload_members',
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'tracked',
      options: [
        { label: 'Tracked', value: 'tracked' },
        { label: 'Converted', value: 'converted' },
        { label: 'Rejected', value: 'rejected' },
      ],
    },
    { name: 'convertedAt', type: 'date' },
  ],
  timestamps: true,
}

export const PayloadAffiliateCommissions: CollectionConfig = {
  slug: 'payload_affiliate_commissions',
  dbName: 'payload_affiliate_commissions',
  labels: {
    singular: 'Affiliate Commission',
    plural: 'Affiliate Commissions',
  },
  admin: {
    group: affiliateGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'affiliate', 'referral', 'amountMinor', 'currency', 'status'],
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'displayName', type: 'text', required: true },
    {
      name: 'affiliate',
      type: 'relationship',
      relationTo: 'payload_affiliates',
      required: true,
      index: true,
    },
    {
      name: 'referral',
      type: 'relationship',
      relationTo: 'payload_affiliate_referrals',
      required: true,
      index: true,
    },
    {
      name: 'amountMinor',
      type: 'number',
      required: true,
      min: 0,
      validate: (value: unknown) =>
        typeof value === 'number' && Number.isInteger(value) && value >= 0
          ? true
          : 'Commission amount must be a non-negative integer in minor currency units.',
    },
    {
      name: 'currency',
      type: 'text',
      required: true,
      defaultValue: 'USD',
      hooks: {
        beforeValidate: [({ value }) => normalizeCurrency(value)],
      },
      validate: (value: unknown) =>
        typeof value === 'string' && /^[A-Z]{3}$/.test(value)
          ? true
          : 'Currency must be a normalized three-letter code.',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Void', value: 'void' },
      ],
    },
  ],
  timestamps: true,
}
