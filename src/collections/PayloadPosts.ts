import type { CollectionConfig } from 'payload'

export const PayloadPosts: CollectionConfig = {
  slug: 'payload_posts',
  dbName: 'payload_posts',
  labels: {
    singular: 'Post',
    plural: 'Posts',
  },
  admin: {
    group: 'Content',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'featuredImage', 'publishedAt', 'updatedAt'],
    description: 'Publish announcements and articles with pictures, downloads and managed video.',
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'excerpt', type: 'textarea' },
    { name: 'content', type: 'richText' },
    {
      name: 'featuredImage',
      type: 'upload',
      relationTo: 'payload_media',
    },
    {
      name: 'gallery',
      type: 'upload',
      relationTo: 'payload_media',
      hasMany: true,
    },
    {
      name: 'featuredVideo',
      type: 'relationship',
      relationTo: 'bunny_videos',
      admin: {
        description: 'Managed Bunny Stream video displayed with this post.',
      },
    },
    {
      name: 'attachments',
      type: 'relationship',
      relationTo: 'payload_media',
      hasMany: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
      defaultValue: 'draft',
    },
    { name: 'publishedAt', type: 'date' },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'payload_categories',
      hasMany: true,
    },
  ],
  timestamps: true,
}
