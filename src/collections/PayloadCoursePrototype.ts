import type { CollectionConfig } from 'payload'

const courseAdminGroup = 'Courses'

// Access helpers: only authenticated admins may mutate; published courses are
// readable by anyone (entitlement enforcement happens at the application layer).
const adminOnly = () => false // deny unauthenticated; Payload grants access to logged-in users by default
const adminOrPublished = ({ req }: { req: { user?: unknown } }) => {
  if (req.user) return true
  return { status: { equals: 'published' } }
}

export const PayloadCourses: CollectionConfig = {
  slug: 'payload_courses',
  dbName: 'payload_courses',
  admin: {
    group: courseAdminGroup,
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'visibility', 'accessBadge', 'updatedAt'],
    description: 'Course catalogue. Create, edit and publish courses from here.',
  },
  access: {
    read: adminOrPublished,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
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
      defaultValue: 'free',
      options: [
        { label: 'Free', value: 'free' },
        { label: 'Pro', value: 'pro' },
        { label: 'VIP', value: 'vip' },
        { label: 'Manual', value: 'manual' },
      ],
      admin: {
        description: 'Access tier label. Entitlement enforcement is handled at the application layer.',
      },
    },
    { name: 'estimatedDuration', type: 'text' },
    { name: 'sortOrder', type: 'number', defaultValue: 0 },
    { name: 'featured', type: 'checkbox', defaultValue: false },
  ],
  timestamps: true,
}

export const PayloadCourseModules: CollectionConfig = {
  slug: 'payload_course_modules',
  dbName: 'payload_course_modules',
  admin: {
    group: courseAdminGroup,
    useAsTitle: 'title',
    defaultColumns: ['title', 'course', 'sortOrder', 'publishedPreview', 'updatedAt'],
    description: 'Ordered sections within a course.',
  },
  access: {
    read: adminOrPublished,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
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
  admin: {
    group: courseAdminGroup,
    useAsTitle: 'title',
    defaultColumns: ['title', 'module', 'sortOrder', 'lockState', 'updatedAt'],
    description: 'Lesson content. Progress tracking is handled at the application layer.',
  },
  access: {
    read: adminOrPublished,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
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
  },
  access: {
    read: adminOrPublished,
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  fields: [
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
