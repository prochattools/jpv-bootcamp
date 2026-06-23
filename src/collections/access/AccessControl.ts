import type { CollectionConfig } from 'payload'

import { adminOnlyCollectionAccess, requirePayloadAdmin } from '@/lib/access/payloadAccess'

const accessControlGroup = 'Members & Access'

const resourceTypeOptions = [
  { label: 'Course', value: 'course' },
  { label: 'Lesson', value: 'lesson' },
  { label: 'Space', value: 'space' },
  { label: 'Access Group', value: 'access_group' },
]

const sourceOptions = [
  { label: 'Manual', value: 'manual' },
  { label: 'Stripe', value: 'stripe' },
  { label: 'Migration', value: 'migration' },
  { label: 'Policy', value: 'policy' },
  { label: 'System', value: 'system' },
]

export const PayloadAccessGroups: CollectionConfig = {
  slug: 'payload_access_groups',
  dbName: 'payload_access_groups',
  labels: {
    singular: 'Access Group',
    plural: 'Access Groups',
  },
  admin: {
    group: accessControlGroup,
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'status', 'groupType', 'updatedAt'],
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    {
      name: 'groupType',
      type: 'select',
      required: true,
      defaultValue: 'manual',
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'Plan', value: 'plan' },
        { label: 'Cohort', value: 'cohort' },
        { label: 'Migration', value: 'migration' },
      ],
    },
    {
      name: 'members',
      type: 'relationship',
      relationTo: 'payload_members',
      hasMany: true,
      admin: {
        description: 'Manual group membership. Automated membership should be reflected through grants/events.',
      },
    },
    { name: 'description', type: 'textarea' },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadAccessPolicies: CollectionConfig = {
  slug: 'payload_access_policies',
  dbName: 'payload_access_policies',
  labels: {
    singular: 'Access Policy',
    plural: 'Access Policies',
  },
  admin: {
    group: accessControlGroup,
    useAsTitle: 'name',
    defaultColumns: ['name', 'resourceType', 'resourceId', 'status', 'priority', 'updatedAt'],
    hidden: true,
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    {
      name: 'resourceType',
      type: 'select',
      required: true,
      options: resourceTypeOptions,
    },
    {
      name: 'resourceId',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Target Payload document id. Kept as text so policies can cover multiple collection types.',
      },
    },
    {
      name: 'privacy',
      type: 'select',
      required: true,
      defaultValue: 'private',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Members', value: 'members' },
        { label: 'Private', value: 'private' },
        { label: 'Secret', value: 'secret' },
      ],
    },
    {
      name: 'allowedPlans',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Exhibitor', value: 'exhibitor' },
        { label: 'Pro', value: 'pro' },
        { label: 'VIP', value: 'vip' },
      ],
    },
    {
      name: 'requiredGroups',
      type: 'relationship',
      relationTo: 'payload_access_groups',
      hasMany: true,
    },
    {
      name: 'requireActiveBilling',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Fail-closed for private paid resources when billing status is not active or trialing.',
      },
    },
    {
      name: 'allowPreviewLessons',
      type: 'checkbox',
      defaultValue: false,
    },
    { name: 'priority', type: 'number', defaultValue: 100 },
    { name: 'startsAt', type: 'date' },
    { name: 'endsAt', type: 'date' },
    { name: 'notes', type: 'textarea' },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadAccessGrants: CollectionConfig = {
  slug: 'payload_access_grants',
  dbName: 'payload_access_grants',
  labels: {
    singular: 'Access Grant',
    plural: 'Access Grants',
  },
  admin: {
    group: accessControlGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'member', 'accessGroup', 'resourceType', 'status', 'source'],
    hidden: true,
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'displayName', type: 'text', required: true },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      index: true,
      admin: {
        description: 'Set this for a direct member grant. Leave empty for group grants.',
      },
    },
    {
      name: 'accessGroup',
      type: 'relationship',
      relationTo: 'payload_access_groups',
      index: true,
      admin: {
        description: 'Set this for a group-level grant. Direct member grant takes precedence in audits.',
      },
    },
    {
      name: 'resourceType',
      type: 'select',
      required: true,
      options: resourceTypeOptions,
    },
    { name: 'resourceId', type: 'text', required: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Active', value: 'active' },
        { label: 'Revoked', value: 'revoked' },
        { label: 'Expired', value: 'expired' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'manual',
      options: sourceOptions,
    },
    {
      name: 'sourceId',
      type: 'text',
      admin: {
        description: 'External id such as Stripe subscription id, migration row id, or admin action id.',
      },
    },
    { name: 'startsAt', type: 'date' },
    { name: 'expiresAt', type: 'date' },
    { name: 'revokedAt', type: 'date' },
    { name: 'revokedReason', type: 'textarea' },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadEntitlementEvents: CollectionConfig = {
  slug: 'payload_entitlement_events',
  dbName: 'payload_entitlement_events',
  labels: {
    singular: 'Entitlement Event',
    plural: 'Entitlement Events',
  },
  admin: {
    group: accessControlGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'member', 'eventType', 'resourceType', 'result', 'createdAt'],
    hidden: true,
  },
  access: {
    ...adminOnlyCollectionAccess,
    create: requirePayloadAdmin,
  },
  fields: [
    { name: 'displayName', type: 'text', required: true },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      index: true,
    },
    {
      name: 'eventType',
      type: 'select',
      required: true,
      options: [
        { label: 'Access Evaluated', value: 'access_evaluated' },
        { label: 'Access Granted', value: 'access_granted' },
        { label: 'Access Revoked', value: 'access_revoked' },
        { label: 'Billing Hold Applied', value: 'billing_hold_applied' },
        { label: 'Billing Hold Cleared', value: 'billing_hold_cleared' },
      ],
    },
    {
      name: 'resourceType',
      type: 'select',
      required: true,
      options: resourceTypeOptions,
    },
    { name: 'resourceId', type: 'text', required: true, index: true },
    {
      name: 'result',
      type: 'select',
      required: true,
      options: [
        { label: 'Allowed', value: 'allowed' },
        { label: 'Denied', value: 'denied' },
        { label: 'Changed', value: 'changed' },
      ],
    },
    { name: 'reason', type: 'text' },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

