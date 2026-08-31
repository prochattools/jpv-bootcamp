import type { CollectionConfig } from 'payload'

import { adminOnlyCollectionAccess } from '@/lib/access/payloadAccess'
import { generatePayloadSlugIfMissing } from '@/lib/domain/slugs'

/**
 * Room-only taxonomy. Categories are presentation/filtering metadata and
 * never participate in the audience or LiveKit authorization decision.
 */
export const PayloadRoomCategories: CollectionConfig = {
  slug: 'payload_room_categories',
  dbName: 'payload_room_categories',
  labels: {
    singular: 'Room Category',
    plural: 'Room Categories',
  },
  admin: {
    group: 'Rooms',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'status', 'sortOrder', 'updatedAt'],
    description: 'Bounded categories for organising member portal Rooms. Categories do not grant access.',
  },
  access: adminOnlyCollectionAccess,
  hooks: {
    beforeValidate: [
      (args) => generatePayloadSlugIfMissing({ ...args, collection: 'payload_room_categories', sourceField: 'name' }),
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true, admin: { hidden: true } },
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
    { name: 'sortOrder', type: 'number', defaultValue: 0, index: true },
    { name: 'description', type: 'textarea' },
  ],
  timestamps: true,
}
