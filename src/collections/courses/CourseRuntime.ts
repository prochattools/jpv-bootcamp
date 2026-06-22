import type { CollectionConfig } from 'payload'
import path from 'node:path'

import {
  adminOnlyCollectionAccess,
  denyPublicWrite,
  requirePayloadAdmin,
  requirePayloadAdminOrRelatedMember,
} from '@/lib/access/payloadAccess'

const courseSystemGroup = 'Course System'

export const PayloadPrivateMedia: CollectionConfig = {
  slug: 'payload_private_media',
  dbName: 'payload_private_media',
  labels: {
    singular: 'Private Course File',
    plural: 'Private Course Files',
  },
  admin: {
    group: courseSystemGroup,
    useAsTitle: 'alt',
    defaultColumns: ['alt', 'filename', 'mimeType', 'updatedAt'],
  },
  upload: {
    staticDir: path.resolve(process.cwd(), 'private/payload-course-media'),
  },
  access: {
    admin: adminOnlyCollectionAccess.admin,
    create: requirePayloadAdmin,
    read: requirePayloadAdmin,
    update: requirePayloadAdmin,
    delete: requirePayloadAdmin,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Internal label for administrators. Private course files are not publicly linked.',
      },
    },
  ],
  timestamps: true,
}

export const PayloadLessonResources: CollectionConfig = {
  slug: 'payload_lesson_resources',
  dbName: 'payload_lesson_resources',
  labels: {
    singular: 'Lesson Resource',
    plural: 'Lesson Resources',
  },
  admin: {
    group: courseSystemGroup,
    useAsTitle: 'title',
    defaultColumns: ['title', 'lesson', 'status', 'downloadRequiresAccess', 'updatedAt'],
  },
  access: {
    admin: adminOnlyCollectionAccess.admin,
    create: requirePayloadAdmin,
    read: requirePayloadAdmin,
    update: requirePayloadAdmin,
    delete: requirePayloadAdmin,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'payload_lessons',
      required: true,
      index: true,
    },
    {
      name: 'file',
      type: 'upload',
      relationTo: 'payload_media',
      admin: {
        description: 'Public media fallback only. Do not use this field for confidential paid lesson files.',
      },
    },
    {
      name: 'protectedFile',
      type: 'upload',
      relationTo: 'payload_private_media',
      admin: {
        description: 'Use this for private paid lesson resources. Learners can only download it through the guarded route.',
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
    {
      name: 'downloadRequiresAccess',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'When true, runtime routes must confirm lesson access before serving the file.',
      },
    },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
    { name: 'description', type: 'textarea' },
  ],
  timestamps: true,
}

export const PayloadCourseEnrollments: CollectionConfig = {
  slug: 'payload_course_enrollments',
  dbName: 'payload_course_enrollments',
  labels: {
    singular: 'Course Enrollment',
    plural: 'Course Enrollments',
  },
  admin: {
    group: courseSystemGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'member', 'course', 'status', 'source', 'updatedAt'],
  },
  access: {
    admin: adminOnlyCollectionAccess.admin,
    create: requirePayloadAdmin,
    read: requirePayloadAdminOrRelatedMember('member'),
    update: requirePayloadAdmin,
    delete: requirePayloadAdmin,
  },
  fields: [
    {
      name: 'displayName',
      type: 'text',
      required: true,
      admin: {
        description: 'Human-readable label such as email + course. Keep stable for audit review.',
      },
    },
    {
      name: 'member',
      type: 'relationship',
      relationTo: 'payload_members',
      required: true,
      index: true,
    },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'payload_courses',
      required: true,
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Active', value: 'active' },
        { label: 'Completed', value: 'completed' },
        { label: 'Revoked', value: 'revoked' },
        { label: 'Expired', value: 'expired' },
      ],
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'manual',
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'Stripe', value: 'stripe' },
        { label: 'Migration', value: 'migration' },
        { label: 'Access Policy', value: 'access_policy' },
      ],
    },
    { name: 'startsAt', type: 'date' },
    { name: 'expiresAt', type: 'date' },
    { name: 'completedAt', type: 'date' },
    { name: 'revokedAt', type: 'date' },
    { name: 'revokedReason', type: 'textarea' },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}

export const PayloadLessonProgress: CollectionConfig = {
  slug: 'payload_lesson_progress',
  dbName: 'payload_lesson_progress',
  labels: {
    singular: 'Lesson Progress',
    plural: 'Lesson Progress',
  },
  admin: {
    group: courseSystemGroup,
    useAsTitle: 'displayName',
    defaultColumns: ['displayName', 'member', 'lesson', 'status', 'completedAt', 'updatedAt'],
  },
  access: {
    admin: adminOnlyCollectionAccess.admin,
    create: denyPublicWrite,
    read: requirePayloadAdminOrRelatedMember('member'),
    update: requirePayloadAdminOrRelatedMember('member'),
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
      name: 'lesson',
      type: 'relationship',
      relationTo: 'payload_lessons',
      required: true,
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'not_started',
      options: [
        { label: 'Not Started', value: 'not_started' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
      ],
    },
    { name: 'startedAt', type: 'date' },
    { name: 'completedAt', type: 'date' },
    {
      name: 'percentComplete',
      type: 'number',
      min: 0,
      max: 100,
      defaultValue: 0,
    },
    { name: 'lastPositionSeconds', type: 'number', min: 0, defaultValue: 0 },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}
