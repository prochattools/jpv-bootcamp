import type { CollectionConfig, PayloadRequest } from 'payload'
import { isPayloadAdminRequest } from '@/lib/access/payloadAccess'

const courseAdminGroup = 'Courses'

// Access helpers: only Payload admin users (payload_users collection) may
// mutate course content; members cannot create, update, or delete.
const adminOnlyWrite = ({ req }: { req: PayloadRequest }) => isPayloadAdminRequest(req)

// Read: admins see everything; members and anonymous users get published-only.
const adminOrPublishedRead = ({ req }: { req: PayloadRequest }) => {
  if (isPayloadAdminRequest(req)) return true
  return { status: { equals: 'published' } }
}

// Lessons have no status field — admins see all; non-admins get preview-only.
const lessonRead = ({ req }: { req: PayloadRequest }) => {
  if (isPayloadAdminRequest(req)) return true
  return { previewLesson: { equals: true } }
}

const normalizeLegacyAccessBadge = ({ value }: { value?: unknown }) => {
  if (value === 'manual' || value === undefined || value === null || value === '') return value
  if (value === 'free' || value === 'pro' || value === 'vip' || value === 'private') return 'manual'
  return value
}

export const PayloadCourses: CollectionConfig = {
  slug: 'payload_courses',
  dbName: 'payload_courses',
  labels: { singular: 'Course', plural: 'Courses' },
  admin: {
    group: courseAdminGroup,
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'visibility', 'coverImage', 'updatedAt'],
    description: 'Course catalogue. Create, edit and publish courses from here.',
  },
  access: {
    read: adminOrPublishedRead,
    create: adminOnlyWrite,
    update: adminOnlyWrite,
    delete: adminOnlyWrite,
  },
  fields: [
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
      defaultValue: 'manual',
      options: [
        { label: 'Manual (JPV Membership Required)', value: 'manual' },
      ],
      admin: {
        description: 'Legacy compatibility value. Runtime access is controlled by JPV Bootcamp Membership and verified Stripe subscription state.',
        hidden: true,
      },
      hooks: { beforeValidate: [normalizeLegacyAccessBadge] },
    },
    { name: 'estimatedDuration', type: 'text' },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
    { name: 'featured', type: 'checkbox', defaultValue: false },
  ],
  timestamps: true,
}

const adminOrModuleRead = ({ req }: { req: PayloadRequest }) => {
  if (isPayloadAdminRequest(req)) return true
  return { publishedPreview: { equals: true } }
}

export const PayloadCourseModules: CollectionConfig = {
  slug: 'payload_course_modules',
  dbName: 'payload_course_modules',
  labels: { singular: 'Course Module', plural: 'Course Modules' },
  admin: {
    group: courseAdminGroup,
    useAsTitle: 'title',
    defaultColumns: ['title', 'course', 'sortOrder', 'publishedPreview', 'updatedAt'],
    description: 'Ordered sections within a course.',
  },
  access: {
    read: adminOrModuleRead,
    create: adminOnlyWrite,
    update: adminOnlyWrite,
    delete: adminOnlyWrite,
  },
  fields: [
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
  labels: { singular: 'Lesson', plural: 'Lessons' },
  admin: {
    group: courseAdminGroup,
    useAsTitle: 'title',
    defaultColumns: ['title', 'module', 'sortOrder', 'lockState', 'updatedAt'],
    description: 'Lesson content. Progress tracking is handled at the application layer.',
  },
  access: {
    read: lessonRead,
    create: adminOnlyWrite,
    update: adminOnlyWrite,
    delete: adminOnlyWrite,
  },
  fields: [
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
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'payload_media',
      admin: {
        description: 'Optional lesson artwork shown in the member portal.',
      },
    },
    { name: 'sortOrder', type: 'number', required: true, defaultValue: 0 },
    { name: 'estimatedDuration', type: 'text' },
    { name: 'content', type: 'richText' },
    {
      name: 'bunnyVideo',
      type: 'relationship',
      relationTo: 'bunny_videos',
      admin: {
        description: 'Managed Bunny Stream video attached to this lesson.',
      },
    },
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
      admin: {
        hidden: true,
        description: 'Legacy import compatibility only. New lesson video must use Bunny Video.',
      },
    },
    {
      name: 'videoIdOrPreviewUrl',
      type: 'text',
      admin: {
        hidden: true,
        description: 'Legacy import compatibility only.',
      },
    },
    {
      name: 'downloads',
      type: 'relationship',
      relationTo: 'payload_media',
      hasMany: true,
    },
    { name: 'previewLesson', type: 'checkbox', defaultValue: false },
    {
      name: 'lockState',
      type: 'select',
      defaultValue: 'available',
      options: [
        { label: 'Available', value: 'available' },
        { label: 'Locked', value: 'locked' },
        { label: 'Coming soon', value: 'coming_soon' },
      ],
      admin: {
        description: 'Controls whether this lesson appears locked in the portal UI.',
      },
    },
  ],
  timestamps: true,
}

export const PayloadCourseAccessPreview: CollectionConfig = {
  slug: 'payload_course_access_preview',
  dbName: 'payload_course_access_preview',
  admin: {
    group: courseAdminGroup,
    useAsTitle: 'displayLabel',
    defaultColumns: ['displayLabel', 'type', 'visualState', 'course', 'updatedAt'],
    description: 'Access tier examples shown in the portal. Not linked to billing or entitlement enforcement.',
    hidden: true,
  },
  access: {
    read: adminOrPublishedRead,
    create: adminOnlyWrite,
    update: adminOnlyWrite,
    delete: adminOnlyWrite,
  },
  fields: [
    { name: 'displayLabel', type: 'text', required: true },
    {
      name: 'type',
      type: 'select',
      required: true,
      defaultValue: 'jpv_bootcamp_membership',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'JPV Bootcamp Membership', value: 'jpv_bootcamp_membership' },
        { label: 'Private', value: 'private' },
      ],
    },
    { name: 'description', type: 'textarea' },
    { name: 'badgeText', type: 'text' },
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
