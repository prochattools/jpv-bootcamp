import type { CollectionConfig } from 'payload'

export const PayloadCourses: CollectionConfig = {
  slug: 'payload_courses',
  dbName: 'payload_courses',
  labels: {
    singular: 'Course',
    plural: 'Courses',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'visibility', 'accessBadge', 'updatedAt'],
    description: 'Visual prototype only. Not connected to Stripe, WordPress, FluentCRM, or FluentCommunity.',
  },
  fields: [
    {
      name: 'prototype',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        readOnly: true,
        description: 'Marks this record as visual prototype data.',
      },
    },
    {
      name: 'prototypeKey',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Stable identifier for local demo content.',
      },
    },
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'shortDescription', type: 'textarea' },
    { name: 'description', type: 'richText' },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'payload_media',
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
    {
      name: 'visibility',
      type: 'select',
      required: true,
      defaultValue: 'members',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Members', value: 'members' },
        { label: 'Restricted', value: 'restricted' },
      ],
    },
    {
      name: 'accessBadge',
      type: 'select',
      required: true,
      defaultValue: 'free',
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Pro', value: 'pro' },
        { label: 'VIP', value: 'vip' },
        { label: 'Manual', value: 'manual' },
      ],
      admin: {
        description: 'Visual label only. This does not grant or enforce access.',
      },
    },
    { name: 'estimatedDuration', type: 'text' },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
    {
      name: 'showInPrototypeDashboard',
      type: 'checkbox',
      defaultValue: true,
    },
    { name: 'featured', type: 'checkbox', defaultValue: false },
    {
      name: 'mockProgress',
      type: 'number',
      min: 0,
      max: 100,
      defaultValue: 0,
      admin: {
        description: 'Visual-only progress value for the prototype dashboard.',
      },
    },
    { name: 'prototypeNote', type: 'textarea' },
  ],
  timestamps: true,
}

export const PayloadCourseModules: CollectionConfig = {
  slug: 'payload_course_modules',
  dbName: 'payload_course_modules',
  labels: {
    singular: 'Module',
    plural: 'Modules',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'course', 'sortOrder', 'publishedPreview', 'updatedAt'],
    description: 'Ordered course sections for the visual prototype.',
  },
  fields: [
    {
      name: 'prototype',
      type: 'checkbox',
      defaultValue: true,
      admin: { readOnly: true },
    },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'payload_courses',
      required: true,
      index: true,
    },
    { name: 'title', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'sortOrder', type: 'number', required: true, defaultValue: 0 },
    { name: 'publishedPreview', type: 'checkbox', defaultValue: true },
  ],
  timestamps: true,
}

export const PayloadLessons: CollectionConfig = {
  slug: 'payload_lessons',
  dbName: 'payload_lessons',
  labels: {
    singular: 'Lesson',
    plural: 'Lessons',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'module', 'sortOrder', 'mockCompletionState', 'visualLockState'],
    description: 'Visual lesson content only. Progress and permissions are not persisted or enforced.',
  },
  fields: [
    {
      name: 'prototype',
      type: 'checkbox',
      defaultValue: true,
      admin: { readOnly: true },
    },
    {
      name: 'module',
      type: 'relationship',
      relationTo: 'payload_course_modules',
      required: true,
      index: true,
    },
    { name: 'title', type: 'text', required: true },
    { name: 'slug', type: 'text', required: true, unique: true, index: true },
    { name: 'summary', type: 'textarea' },
    { name: 'sortOrder', type: 'number', required: true, defaultValue: 0 },
    { name: 'estimatedDuration', type: 'text' },
    { name: 'content', type: 'richText' },
    {
      name: 'videoProviderLabel',
      type: 'select',
      options: [
        { label: 'None', value: 'none' },
        { label: 'YouTube', value: 'youtube' },
        { label: 'Vimeo', value: 'vimeo' },
        { label: 'Mux', value: 'mux' },
        { label: 'Other', value: 'other' },
      ],
      defaultValue: 'none',
    },
    { name: 'videoIdOrPreviewUrl', type: 'text' },
    {
      name: 'downloads',
      type: 'relationship',
      relationTo: 'payload_media',
      hasMany: true,
    },
    { name: 'previewLesson', type: 'checkbox', defaultValue: false },
    {
      name: 'mockCompletionState',
      type: 'select',
      defaultValue: 'not_started',
      options: [
        { label: 'Not started', value: 'not_started' },
        { label: 'In progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
      ],
      admin: {
        description: 'Visual-only completion state.',
      },
    },
    {
      name: 'visualLockState',
      type: 'select',
      defaultValue: 'available',
      options: [
        { label: 'Available', value: 'available' },
        { label: 'Locked', value: 'locked' },
        { label: 'Coming soon', value: 'coming_soon' },
      ],
      admin: {
        description: 'Visual-only lock state. This is not authorization.',
      },
    },
    { name: 'prototypeNote', type: 'textarea' },
  ],
  timestamps: true,
}

export const PayloadCourseAccessPreview: CollectionConfig = {
  slug: 'payload_course_access_preview',
  dbName: 'payload_course_access_preview',
  labels: {
    singular: 'Access Preview',
    plural: 'Access Previews',
  },
  admin: {
    useAsTitle: 'displayLabel',
    defaultColumns: ['displayLabel', 'type', 'visualState', 'course', 'updatedAt'],
    description: 'Visual access examples only. No real member, billing, or entitlement data is connected.',
  },
  fields: [
    {
      name: 'prototype',
      type: 'checkbox',
      defaultValue: true,
      admin: { readOnly: true },
    },
    { name: 'displayLabel', type: 'text', required: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Pro', value: 'pro' },
        { label: 'VIP', value: 'vip' },
        { label: 'Manual', value: 'manual' },
        { label: 'Private', value: 'private' },
      ],
    },
    { name: 'description', type: 'textarea' },
    { name: 'badgeText', type: 'text' },
    { name: 'exampleMemberName', type: 'text' },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'payload_courses',
    },
    {
      name: 'visualState',
      type: 'select',
      required: true,
      defaultValue: 'available',
      options: [
        { label: 'Available', value: 'available' },
        { label: 'Locked', value: 'locked' },
        { label: 'Coming soon', value: 'coming_soon' },
      ],
    },
  ],
  timestamps: true,
}
