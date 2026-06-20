import type { CollectionConfig } from 'payload'

export const PayloadPosts: CollectionConfig = {
  slug: 'payload_posts',
  dbName: 'payload_posts',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'createdAt'],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', unique: true, index: true },
    { name: 'content', type: 'richText' },
    {
      name: 'status',
      type: 'select',
      options: ['draft', 'published'],
      defaultValue: 'draft',
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'payload_categories',
      hasMany: true,
    },
  ],
  timestamps: true,
}
