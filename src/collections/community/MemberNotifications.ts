import type { CollectionConfig } from 'payload'

import {
  adminOnlyCollectionAccess,
  requirePayloadAdmin,
  requirePayloadAdminOrRelatedMember,
} from '@/lib/access/payloadAccess'

export const PayloadMemberNotifications: CollectionConfig = {
  slug: 'payload_member_notifications',
  dbName: 'payload_member_notifications',
  labels: {
    singular: 'Member Notification',
    plural: 'Member Notifications',
  },
  admin: {
    group: 'Community',
    hidden: true,
    useAsTitle: 'title',
    defaultColumns: ['member', 'type', 'title', 'read', 'createdAt'],
    description: 'In-app notification records for portal members.',
  },
  access: {
    admin: adminOnlyCollectionAccess.admin,
    create: requirePayloadAdmin,
    read: requirePayloadAdminOrRelatedMember('member'),
    update: requirePayloadAdminOrRelatedMember('member'),
    delete: requirePayloadAdmin,
  },
  fields: [
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      required: true,
      index: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'New Post', value: 'new_post' },
        { label: 'New Comment', value: 'new_comment' },
        { label: 'Mention', value: 'mention' },
        { label: 'System', value: 'system' },
      ],
    },
    { name: 'actorName', type: 'text' },
    { name: 'title', type: 'text' },
    { name: 'href', type: 'text' },
    {
      name: 'read',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
  timestamps: true,
}
