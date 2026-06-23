import type { CollectionConfig } from 'payload'

import {
  adminOnlyCollectionAccess,
  denyPublicWrite,
  requirePayloadAdmin,
  requirePayloadAdminOrRelatedMember,
} from '@/lib/access/payloadAccess'

const communityGroup = 'Community'

const moderationStatusOptions = [
  { label: 'Visible', value: 'visible' },
  { label: 'Pending Review', value: 'pending_review' },
  { label: 'Hidden', value: 'hidden' },
  { label: 'Deleted', value: 'deleted' },
]

export const PayloadMemberGroups: CollectionConfig = {
  slug: 'payload_member_groups',
  dbName: 'payload_member_groups',
  labels: {
    singular: 'Member Group',
    plural: 'Member Groups',
  },
  admin: {
    group: 'Members & Access',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'status', 'visibility', 'updatedAt'],
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    {
      name: 'visibility',
      type: 'select',
      required: true,
      defaultValue: 'private',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Private', value: 'private' },
        { label: 'Secret', value: 'secret' },
      ],
    },
    {
      name: 'members',
      type: 'relationship',
      relationTo: 'payload_members',
      hasMany: true,
    },
    { name: 'description', type: 'textarea' },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadSpaces: CollectionConfig = {
  slug: 'payload_spaces',
  dbName: 'payload_spaces',
  labels: {
    singular: 'Community Space',
    plural: 'Community Spaces',
  },
  admin: {
    group: communityGroup,
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'spaceType', 'visibility', 'status'],
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
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
    {
      name: 'spaceType',
      type: 'select',
      required: true,
      defaultValue: 'discussion',
      options: [
        { label: 'Discussion', value: 'discussion' },
        { label: 'Course Cohort', value: 'course_cohort' },
        { label: 'Announcement', value: 'announcement' },
        { label: 'Chat', value: 'chat' },
      ],
    },
    {
      name: 'visibility',
      type: 'select',
      required: true,
      defaultValue: 'private',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Members', value: 'members' },
        { label: 'Private', value: 'private' },
        { label: 'Secret', value: 'secret' },
      ],
    },
    {
      name: 'requiredAccessGroups',
      type: 'relationship',
      relationTo: 'payload_access_groups',
      hasMany: true,
    },
    {
      name: 'linkedCourse',
      type: 'relationship',
      relationTo: 'payload_courses',
    },
    { name: 'description', type: 'textarea' },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadSpaceMemberships: CollectionConfig = {
  slug: 'payload_space_memberships',
  dbName: 'payload_space_memberships',
  labels: {
    singular: 'Space Membership',
    plural: 'Space Memberships',
  },
  admin: {
    group: communityGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'member', 'space', 'role', 'status'],
    hidden: true,
  },
  access: {
    admin: adminOnlyCollectionAccess.admin,
    create: requirePayloadAdmin,
    read: requirePayloadAdminOrRelatedMember('member'),
    update: requirePayloadAdmin,
    delete: requirePayloadAdmin,
  },
  fields: [
    { name: 'displayName', type: 'text', required: true },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      required: true,
      index: true,
    },
    {
      name: 'space',
      type: 'relationship',
      relationTo: 'payload_spaces',
      required: true,
      index: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'member',
      options: [
        { label: 'Member', value: 'member' },
        { label: 'Moderator', value: 'moderator' },
        { label: 'Admin', value: 'admin' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Active', value: 'active' },
        { label: 'Muted', value: 'muted' },
        { label: 'Blocked', value: 'blocked' },
        { label: 'Removed', value: 'removed' },
      ],
    },
    { name: 'joinedAt', type: 'date' },
    { name: 'expiresAt', type: 'date' },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadSpacePosts: CollectionConfig = {
  slug: 'payload_space_posts',
  dbName: 'payload_space_posts',
  labels: {
    singular: 'Community Post',
    plural: 'Community Posts',
  },
  admin: {
    group: communityGroup,
    useAsTitle: 'title',
    defaultColumns: ['title', 'space', 'author', 'moderationStatus', 'createdAt'],
  },
  access: {
    admin: adminOnlyCollectionAccess.admin,
    create: denyPublicWrite,
    read: requirePayloadAdmin,
    update: requirePayloadAdminOrRelatedMember('author'),
    delete: requirePayloadAdmin,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'space',
      type: 'relationship',
      relationTo: 'payload_spaces',
      required: true,
      index: true,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'payload_members',
      required: true,
      index: true,
    },
    {
      name: 'postType',
      type: 'select',
      required: true,
      defaultValue: 'discussion',
      options: [
        { label: 'Discussion', value: 'discussion' },
        { label: 'Question', value: 'question' },
        { label: 'Announcement', value: 'announcement' },
      ],
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
    },
    {
      name: 'moderationStatus',
      type: 'select',
      required: true,
      defaultValue: 'visible',
      options: moderationStatusOptions,
    },
    { name: 'pinned', type: 'checkbox', defaultValue: false },
    { name: 'locked', type: 'checkbox', defaultValue: false },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadSpaceComments: CollectionConfig = {
  slug: 'payload_space_comments',
  dbName: 'payload_space_comments',
  labels: {
    singular: 'Community Comment',
    plural: 'Community Comments',
  },
  admin: {
    group: communityGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'post', 'author', 'moderationStatus', 'createdAt'],
    hidden: true,
  },
  access: {
    admin: adminOnlyCollectionAccess.admin,
    create: denyPublicWrite,
    read: requirePayloadAdmin,
    update: requirePayloadAdminOrRelatedMember('author'),
    delete: requirePayloadAdmin,
  },
  fields: [
    { name: 'displayName', type: 'text', required: true },
    {
      name: 'post',
      type: 'relationship',
      relationTo: 'payload_space_posts',
      required: true,
      index: true,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'payload_members',
      required: true,
      index: true,
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
    },
    {
      name: 'moderationStatus',
      type: 'select',
      required: true,
      defaultValue: 'visible',
      options: moderationStatusOptions,
    },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadSpaceFiles: CollectionConfig = {
  slug: 'payload_space_files',
  dbName: 'payload_space_files',
  labels: {
    singular: 'Community File',
    plural: 'Community Files',
  },
  admin: {
    group: communityGroup,
    useAsTitle: 'title',
    defaultColumns: ['title', 'space', 'uploadedBy', 'moderationStatus', 'createdAt'],
    hidden: true,
  },
  access: {
    admin: adminOnlyCollectionAccess.admin,
    create: denyPublicWrite,
    read: requirePayloadAdmin,
    update: requirePayloadAdminOrRelatedMember('uploadedBy'),
    delete: requirePayloadAdmin,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'space',
      type: 'relationship',
      relationTo: 'payload_spaces',
      required: true,
      index: true,
    },
    {
      name: 'uploadedBy',
      type: 'relationship',
      relationTo: 'payload_members',
      required: true,
      index: true,
    },
    {
      name: 'file',
      type: 'upload',
      relationTo: 'payload_media',
      required: true,
    },
    {
      name: 'moderationStatus',
      type: 'select',
      required: true,
      defaultValue: 'visible',
      options: moderationStatusOptions,
    },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadChatThreads: CollectionConfig = {
  slug: 'payload_chat_threads',
  dbName: 'payload_chat_threads',
  labels: {
    singular: 'Chat Thread',
    plural: 'Chat Threads',
  },
  admin: {
    group: communityGroup,
    useAsTitle: 'title',
    defaultColumns: ['title', 'space', 'status', 'lastMessageAt'],
    hidden: true,
  },
  access: adminOnlyCollectionAccess,
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'space',
      type: 'relationship',
      relationTo: 'payload_spaces',
      index: true,
    },
    {
      name: 'participants',
      type: 'relationship',
      relationTo: 'payload_members',
      hasMany: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'open',
      options: [
        { label: 'Open', value: 'open' },
        { label: 'Locked', value: 'locked' },
        { label: 'Archived', value: 'archived' },
      ],
    },
    { name: 'lastMessageAt', type: 'date' },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadChatMessages: CollectionConfig = {
  slug: 'payload_chat_messages',
  dbName: 'payload_chat_messages',
  labels: {
    singular: 'Chat Message',
    plural: 'Chat Messages',
  },
  admin: {
    group: communityGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'thread', 'author', 'moderationStatus', 'createdAt'],
    hidden: true,
  },
  access: {
    admin: adminOnlyCollectionAccess.admin,
    create: denyPublicWrite,
    read: requirePayloadAdmin,
    update: requirePayloadAdminOrRelatedMember('author'),
    delete: requirePayloadAdmin,
  },
  fields: [
    { name: 'displayName', type: 'text', required: true },
    {
      name: 'thread',
      type: 'relationship',
      relationTo: 'payload_chat_threads',
      required: true,
      index: true,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'payload_members',
      required: true,
      index: true,
    },
    { name: 'body', type: 'textarea', required: true },
    {
      name: 'moderationStatus',
      type: 'select',
      required: true,
      defaultValue: 'visible',
      options: moderationStatusOptions,
    },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

