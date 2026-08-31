import type { CollectionConfig } from 'payload'

import { generatePayloadSlugIfMissing } from '@/lib/domain/slugs'

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
    defaultColumns: ['title', 'status', 'featuredImage', 'updatedAt'],
    description: 'Publish rich pages with managed images and Bunny video.',
  },
  hooks: {
    beforeValidate: [
      (args) => generatePayloadSlugIfMissing({ ...args, collection: 'payload_pages', sourceField: 'title' }),
    ],
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true, admin: { hidden: true } },
    { name: 'portalRoute', type: 'text', admin: { description: 'Portal URL path this page maps to (e.g. "/portal/community/start-here")' } },
    { name: 'summary', type: 'textarea' },
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
        description: 'Managed Bunny Stream video displayed with this page.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    { name: 'publishedAt', type: 'date' },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
  ],
  timestamps: true,
}
