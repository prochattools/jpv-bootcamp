import type { CollectionConfig } from 'payload'

export const PayloadCategories: CollectionConfig = {
  slug: 'payload_categories',
  dbName: 'payload_categories',
  admin: {
    useAsTitle: 'title',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
  ],
}
