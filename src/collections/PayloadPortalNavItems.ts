import type { CollectionConfig } from 'payload'

import { requirePayloadAdmin } from '@/lib/access/payloadAccess'

export const PayloadPortalNavItems: CollectionConfig = {
  slug: 'payload_portal_nav_items',
  dbName: 'payload_portal_nav_items',
  labels: {
    singular: 'Portal Nav Item',
    plural: 'Portal Nav Items',
  },
  admin: {
    group: 'Settings',
    useAsTitle: 'label',
    defaultColumns: ['label', 'navGroup', 'href', 'itemSortOrder', 'status'],
    description: 'Configure the member portal sidebar navigation. Group items under labels like "Learn", "Community", "Explore".',
  },
  access: {
    read: requirePayloadAdmin,
    create: requirePayloadAdmin,
    update: requirePayloadAdmin,
    delete: requirePayloadAdmin,
  },
  fields: [
    { name: 'label', type: 'text', required: true, admin: { description: 'Display name in the sidebar (e.g. "Dashboard", "Courses")' } },
    { name: 'href', type: 'text', required: true, admin: { description: 'Portal route (e.g. "/portal/courses")' } },
    { name: 'iconName', type: 'text', admin: { description: 'Lucide icon name (e.g. "LayoutDashboard", "GraduationCap", "Users")' } },
    {
      name: 'navGroup',
      type: 'text',
      required: true,
      admin: { description: 'Group title this item belongs to (e.g. "Learn", "Community", "Explore")' },
    },
    { name: 'groupSortOrder', type: 'number', defaultValue: 0, admin: { description: 'Sort order of the group itself (lower = higher in sidebar)' } },
    { name: 'itemSortOrder', type: 'number', defaultValue: 0, admin: { description: 'Sort order within the group (lower = higher)' } },
    { name: 'highlighted', type: 'checkbox', defaultValue: false, admin: { description: 'Show with accent background (for onboarding items like "Start here")' } },
    {
      name: 'linkedPage',
      type: 'relationship',
      relationTo: 'payload_pages',
      admin: { description: 'Optional: link to a Page for content editing' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Hidden', value: 'hidden' },
      ],
    },
  ],
  timestamps: true,
}
