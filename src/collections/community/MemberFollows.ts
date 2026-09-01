import type { CollectionConfig } from 'payload'

import { adminOnlyCollectionAccess } from '@/lib/access/payloadAccess'

export const PayloadMemberFollows: CollectionConfig = {
  slug: 'payload_member_follows',
  dbName: 'payload_member_follows',
  labels: { singular: 'Member Follow', plural: 'Member Follows' },
  admin: {
    group: 'Community',
    hidden: true,
    useAsTitle: 'followerMember',
    defaultColumns: ['followerMember', 'followedMember', 'createdAt'],
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'followerMember', type: 'relationship', relationTo: 'payload_members', required: true, index: true },
    { name: 'followedMember', type: 'relationship', relationTo: 'payload_members', required: true, index: true },
  ],
  timestamps: true,
}
