import type { CollectionConfig } from 'payload'

import { adminOnlyCollectionAccess } from '@/lib/access/payloadAccess'

export const PayloadMemberVerificationRecords: CollectionConfig = {
  slug: 'payload_member_verification_tokens',
  dbName: 'payload_member_verification_tokens',
  labels: {
    singular: 'Member Verification Record',
    plural: 'Member Verification Records',
  },
  admin: {
    group: 'Members',
    hidden: true,
    useAsTitle: 'idempotencyKey',
    defaultColumns: ['member', 'purpose', 'expiresAt', 'consumedAt', 'invalidatedAt'],
    description: 'Digest-only, single-use member verification records. Plaintext tokens are never stored.',
  },
  lockDocuments: false,
  access: adminOnlyCollectionAccess,
  fields: [
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      required: true,
      index: true,
    },
    { name: 'email', type: 'email', required: true, index: true },
    {
      name: 'purpose',
      type: 'select',
      required: true,
      defaultValue: 'member_email_verification',
      options: [
        { label: 'Member email verification', value: 'member_email_verification' },
        { label: 'Member invitation', value: 'member_invitation' },
        { label: 'Set password', value: 'set_password' },
        { label: 'Password reset', value: 'password_reset' },
        { label: 'Email change confirmation', value: 'email_change_confirmation' },
      ],
      index: true,
    },
    {
      name: 'tokenDigest',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { hidden: true },
      access: {
        read: () => false,
      },
    },
    { name: 'expiresAt', type: 'date', required: true, index: true },
    { name: 'consumedAt', type: 'date', index: true },
    { name: 'invalidatedAt', type: 'date', index: true },
    { name: 'lastSentAt', type: 'date' },
    { name: 'sendAttempts', type: 'number', required: true, defaultValue: 0, min: 0 },
    {
      name: 'idempotencyKey',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { hidden: true },
    },
  ],
  timestamps: true,
}
