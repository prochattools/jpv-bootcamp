import type { CollectionConfig } from 'payload'

export const PayloadCategories: CollectionConfig = {
  slug: 'payload_categories',
  dbName: 'payload_categories',
  labels: {
    singular: 'Category',
    plural: 'Categories',
  },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    description: 'Taxonomy categories used to organize posts and content.',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
  ],
}
