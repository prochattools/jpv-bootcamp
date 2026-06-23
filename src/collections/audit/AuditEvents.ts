import type { CollectionConfig } from 'payload'

import { adminOnlyCollectionAccess } from '@/lib/access/payloadAccess'

export const PayloadAuditEvents: CollectionConfig = {
  slug: 'payload_audit_events',
  dbName: 'payload_audit_events',
  labels: {
    singular: 'Audit Event',
    plural: 'Audit Events',
  },
  admin: {
    group: 'Administration',
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'actorType', 'action', 'targetCollection', 'createdAt'],
    hidden: true,
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'displayName', type: 'text', required: true },
    {
      name: 'actorType',
      type: 'select',
      required: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Member', value: 'member' },
        { label: 'Stripe', value: 'stripe' },
        { label: 'System', value: 'system' },
        { label: 'Migration', value: 'migration' },
      ],
    },
    { name: 'actorId', type: 'text', index: true },
    { name: 'action', type: 'text', required: true, index: true },
    { name: 'targetCollection', type: 'text', required: true, index: true },
    { name: 'targetId', type: 'text', index: true },
    {
      name: 'severity',
      type: 'select',
      required: true,
      defaultValue: 'info',
      options: [
        { label: 'Info', value: 'info' },
        { label: 'Warning', value: 'warning' },
        { label: 'Critical', value: 'critical' },
      ],
    },
    { name: 'ipAddress', type: 'text' },
    { name: 'userAgent', type: 'text' },
    { name: 'before', type: 'json' },
    { name: 'after', type: 'json' },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

