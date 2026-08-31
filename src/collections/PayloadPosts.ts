import type { CollectionConfig } from 'payload'

import { generatePayloadSlugIfMissing } from '@/lib/domain/slugs'

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
  hooks: {
    beforeValidate: [
      (args) => generatePayloadSlugIfMissing({ ...args, collection: 'payload_posts', sourceField: 'title' }),
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true, admin: { hidden: true } },
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
    {
      name: 'audience',
      type: 'select',
      required: true,
      defaultValue: 'all',
      options: [
        { label: 'All active members', value: 'all' },
        { label: 'Selected members', value: 'selected' },
      ],
      admin: {
        description: 'Controls which members see this published update in the portal. Group-targeted rows use selected plus groupIds in the existing target JSON field.',
      },
    },
    {
      name: 'targetMemberIds',
      type: 'json',
      admin: {
        hidden: true,
        description: 'Backward-compatible audience selection object: { memberIds, groupIds }. Older rows may remain a member ID array.',
      },
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
