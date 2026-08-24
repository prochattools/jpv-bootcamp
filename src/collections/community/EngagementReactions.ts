import type { CollectionConfig } from 'payload'

import { adminOnlyCollectionAccess } from '@/lib/access/payloadAccess'

export const PayloadEngagementReactions: CollectionConfig = {
  slug: 'payload_engagement_reactions',
  dbName: 'payload_engagement_reactions',
  labels: {
    singular: 'Engagement Reaction',
    plural: 'Engagement Reactions',
  },
  admin: {
    group: 'Community',
    useAsTitle: 'reactionType',
    defaultColumns: ['reactionType', 'targetKind', 'member', 'createdAt'],
    description: 'Active member-owned reactions. Legacy space reactions remain separate.',
  },
  access: adminOnlyCollectionAccess,
  fields: [
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      required: true,
      index: true,
    },
    {
      name: 'reactionType',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Helpful', value: 'helpful' },
        { label: 'Insightful', value: 'insightful' },
        { label: 'Celebrate', value: 'celebrate' },
      ],
    },
    {
      name: 'targetKind',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Community post', value: 'space_post' },
        { label: 'Community comment', value: 'space_comment' },
        { label: 'Lesson discussion', value: 'lesson_comment' },
      ],
    },
    {
      name: 'targetPost',
      type: 'relationship',
      relationTo: 'payload_space_posts',
      index: true,
    },
    {
      name: 'targetSpaceComment',
      type: 'relationship',
      relationTo: 'payload_space_comments',
      index: true,
    },
    {
      name: 'targetLessonComment',
      type: 'relationship',
      relationTo: 'payload_lesson_comments',
      index: true,
    },
    {
      name: 'metadata',
      type: 'json',
      admin: { hidden: true },
    },
  ],
  timestamps: true,
}
