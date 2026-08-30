import type { CollectionConfig } from 'payload'

import { adminOnlyCollectionAccess } from '@/lib/access/payloadAccess'

/**
 * Durable Room/member entitlement ledger. A row is retained when revoked so
 * audience removals cannot silently fall back to a legacy relationship rule.
 */
export const PayloadRoomAccess: CollectionConfig = {
  slug: 'payload_room_access',
  dbName: 'payload_room_access',
  labels: {
    singular: 'Room Access Grant',
    plural: 'Room Access Grants',
  },
  admin: {
    group: 'Rooms',
    hidden: true,
    useAsTitle: 'eventKey',
    defaultColumns: ['room', 'member', 'grantSource', 'status', 'grantedAt', 'revokedAt'],
    description: 'Durable Room/member entitlement ledger used by portal and LiveKit authorization.',
  },
  access: adminOnlyCollectionAccess,
  fields: [
    {
      name: 'room',
      type: 'relationship',
      relationTo: 'live_sessions',
      required: true,
      index: true,
    },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      required: true,
      index: true,
    },
    {
      name: 'grantSource',
      type: 'select',
      required: true,
      defaultValue: 'all_active',
      options: [
        { label: 'All active members', value: 'all_active' },
        { label: 'Selected member', value: 'selected' },
        { label: 'Member group', value: 'member_group' },
        { label: 'Legacy enrollment or space membership', value: 'enrolled' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Revoked', value: 'revoked' },
      ],
      index: true,
    },
    { name: 'eventKey', type: 'text', required: true, unique: true, index: true },
    { name: 'grantedAt', type: 'date', required: true },
    { name: 'revokedAt', type: 'date' },
    { name: 'metadata', type: 'json', admin: { hidden: true } },
  ],
  timestamps: true,
}
