import type { CollectionConfig } from 'payload'

export const PayloadPages: CollectionConfig = {
  slug: 'payload_pages',
  dbName: 'payload_pages',
  labels: {
    singular: 'Page',
    plural: 'Pages',
  },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', 'createdAt'],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true, index: true },
    { name: 'content', type: 'richText' },
  ],
  timestamps: true,
}
