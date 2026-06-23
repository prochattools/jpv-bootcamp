import type { CollectionConfig } from 'payload'
import {
  adminOnlyCollectionAccess,
  denyPublicWrite,
  requirePayloadAdmin,
  requirePayloadAdminOrRelatedMember,
  requirePayloadAdminOrMemberSelf,
} from '@/lib/access/payloadAccess'

export const PayloadMembers: CollectionConfig = {
  slug: 'payload_members',
  dbName: 'payload_members',
  labels: {
    singular: 'Member',
    plural: 'Members',
  },
  auth: {
    forgotPassword: {
      expiration: 60 * 60 * 1000,
    },
  },
  admin: {
    useAsTitle: 'email',
    defaultColumns: ['email', 'accountStatus', 'source', 'billingHoldReason', 'updatedAt'],
    group: 'Members & Access',
    description: 'Student and client accounts. This is separate from Payload administrator users.',
  },
  access: {
    admin: adminOnlyCollectionAccess.admin,
    create: denyPublicWrite,
    read: requirePayloadAdminOrMemberSelf,
    update: requirePayloadAdminOrMemberSelf,
    delete: requirePayloadAdmin,
  },
  fields: [
    {
      name: 'accountStatus',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Active', value: 'active' },
        { label: 'Blocked', value: 'blocked' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Deleted', value: 'deleted' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'admin_created',
      options: [
        { label: 'Self signup', value: 'self_signup' },
        { label: 'Admin created', value: 'admin_created' },
        { label: 'Stripe checkout', value: 'stripe_checkout' },
        { label: 'Migration', value: 'migration' },
      ],
    },
    { name: 'emailVerifiedAt', type: 'date' },
    { name: 'billingHoldReason', type: 'text' },
    { name: 'lastLoginAt', type: 'date' },
    { name: 'lastLoginIp', type: 'text' },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Internal administrator notes. Do not show this to members.',
      },
    },
  ],
  timestamps: true,
}

export const PayloadMemberProfiles: CollectionConfig = {
  slug: 'payload_member_profiles',
  dbName: 'payload_member_profiles',
  labels: {
    singular: 'Member Profile',
    plural: 'Member Profiles',
  },
  admin: {
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'member', 'company', 'updatedAt'],
    group: 'Members & Access',
    hidden: true,
  },
  access: {
    admin: adminOnlyCollectionAccess.admin,
    create: requirePayloadAdmin,
    read: requirePayloadAdminOrRelatedMember('member'),
    update: requirePayloadAdminOrRelatedMember('member'),
    delete: requirePayloadAdmin,
  },
  fields: [
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      required: true,
      unique: true,
      index: true,
    },
    { name: 'displayName', type: 'text', required: true },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'payload_media',
    },
    { name: 'timezone', type: 'text' },
    { name: 'phone', type: 'text' },
    { name: 'company', type: 'text' },
    { name: 'marketingConsent', type: 'checkbox', defaultValue: false },
    { name: 'transactionalEmailConsent', type: 'checkbox', defaultValue: true },
  ],
  timestamps: true,
}

export const PayloadMemberSecurityEvents: CollectionConfig = {
  slug: 'payload_member_security_events',
  dbName: 'payload_member_security_events',
  labels: {
    singular: 'Member Security Event',
    plural: 'Member Security Events',
  },
  admin: {
    useAsTitle: 'eventType',
    defaultColumns: ['eventType', 'member', 'createdAt'],
    group: 'Members & Access',
    hidden: true,
  },
  access: adminOnlyCollectionAccess,
  fields: [
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      required: true,
      index: true,
    },
    {
      name: 'eventType',
      type: 'select',
      required: true,
      options: [
        { label: 'Account created', value: 'account_created' },
        { label: 'Email verified', value: 'email_verified' },
        { label: 'Password reset requested', value: 'password_reset_requested' },
        { label: 'Password changed', value: 'password_changed' },
        { label: 'Login failed', value: 'login_failed' },
        { label: 'Account blocked', value: 'account_blocked' },
        { label: 'Account restored', value: 'account_restored' },
      ],
    },
    { name: 'source', type: 'text' },
    { name: 'ipAddress', type: 'text' },
    { name: 'userAgent', type: 'text' },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}
