import type { CollectionConfig, FilterOptionsProps } from 'payload'

import {
  assertLiveSessionRelationships,
  liveSessionRelationshipId,
  prepareLiveSessionMutation,
  type LiveSessionDocument,
} from '@/lib/liveSessions/sessionLifecycle'

function hasActiveSpaceMembership(
  memberships: Array<Record<string, unknown>>,
  spaceId: string,
): boolean {
  return memberships.some(
    (m) =>
      liveSessionRelationshipId(m.space) === spaceId && m.status === 'active',
  )
}

function filterModulesByCourse({ siblingData }: FilterOptionsProps) {
  const courseId = liveSessionRelationshipId((siblingData as Record<string, unknown>)?.course)
  if (!courseId) return false
  return { course: { equals: courseId } }
}

function filterLessonsByModule({ siblingData }: FilterOptionsProps) {
  const moduleId = liveSessionRelationshipId((siblingData as Record<string, unknown>)?.module)
  if (!moduleId) return false
  return { module: { equals: moduleId } }
}

export const PayloadLiveSession: CollectionConfig = {
  slug: 'live_sessions',
  dbName: 'live_sessions',
  labels: {
    singular: 'Room',
    plural: 'Rooms',
  },
  admin: {
    group: 'Rooms',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'scheduledAt', 'course', 'space', 'hostUser', 'updatedAt'],
    description: 'Schedule and operate member portal Rooms. Room names and audit history are generated automatically.',
  },
  access: {
    read: async ({ req }) => {
      if (req.user?.collection === 'payload_users') return true
      if (req.user?.collection !== 'payload_members') return false

      const [enrollments, memberships, roomAccess] = await Promise.all([
        req.payload.find({
          collection: 'payload_course_enrollments',
          where: {
            and: [
              { member: { equals: req.user.id } },
              { status: { equals: 'active' } },
            ],
          },
          limit: 200,
          depth: 0,
          overrideAccess: true,
        }),
        req.payload.find({
          collection: 'payload_space_memberships',
          where: {
            and: [
              { member: { equals: req.user.id } },
              { status: { equals: 'active' } },
            ],
          },
          limit: 200,
          depth: 0,
          overrideAccess: true,
        }),
        req.payload.find({
          collection: 'payload_room_access',
          where: {
            and: [
              { member: { equals: req.user.id } },
              { status: { equals: 'active' } },
            ],
          },
          limit: 500,
          depth: 0,
          overrideAccess: true,
        }),
      ])

      const courseIds = enrollments.docs
        .map((e) => liveSessionRelationshipId(e.course))
        .filter((id): id is string => Boolean(id))
      const spaceIds = memberships.docs
        .map((m) => liveSessionRelationshipId(m.space))
        .filter((id): id is string => Boolean(id))
      const roomIds = roomAccess.docs
        .map((grant) => liveSessionRelationshipId(grant.room))
        .filter((id): id is string => Boolean(id))

      if (courseIds.length === 0 && spaceIds.length === 0 && roomIds.length === 0) return false
      return {
        or: [
          ...(roomIds.length > 0 ? [{ id: { in: roomIds } }] : []),
          ...(courseIds.length > 0 ? [{ course: { in: courseIds } }] : []),
          ...(spaceIds.length > 0 ? [{ space: { in: spaceIds } }] : []),
          // Legacy all-audience records predate the durable ledger. New Rooms
          // always receive ledger rows during creation/edit commands.
          { audience: { equals: 'all' } },
        ],
      }
    },
    create: ({ req }) => req.user?.collection === 'payload_users',
    update: ({ req }) => req.user?.collection === 'payload_users',
    delete: ({ req }) => req.user?.collection === 'payload_users',
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        const merged = {
          ...(originalDoc as LiveSessionDocument | undefined),
          ...(data as LiveSessionDocument),
        }
        const mergedCourse = liveSessionRelationshipId(merged.course)
        if (mergedCourse) {
          await assertLiveSessionRelationships({
            payload: req.payload,
            course: merged.course,
            module: merged.module,
            lesson: merged.lesson,
          })
        }

        return prepareLiveSessionMutation({
          operation,
          data: data as LiveSessionDocument,
          originalDoc: originalDoc as LiveSessionDocument | undefined,
          operatorId: req.user?.id,
        })
      },
    ],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      label: 'Session Title',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'scheduled',
      options: [
        { label: 'Scheduled', value: 'scheduled' },
        { label: 'Live', value: 'live' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
    },
    {
      name: 'course',
      type: 'relationship',
      relationTo: 'payload_courses',
      label: 'Course',
      admin: {
        description: 'Optional. Link this session to a course when it is course-specific.',
      },
    },
    {
      name: 'module',
      type: 'relationship',
      relationTo: 'payload_course_modules',
      label: 'Module',
      filterOptions: filterModulesByCourse,
      admin: {
        description: 'Optional. Select a course first — only modules from that course appear.',
      },
    },
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'payload_lessons',
      label: 'Lesson',
      filterOptions: filterLessonsByModule,
      admin: {
        description: 'Optional. Select a module first — only lessons from that module appear.',
      },
    },
    {
      name: 'space',
      type: 'relationship',
      relationTo: 'payload_spaces',
      label: 'Community Space',
      admin: {
        description: 'Optional. Link this session to a community space when it is space-specific.',
      },
    },
    {
      name: 'roomName',
      type: 'text',
      unique: true,
      index: true,
      label: 'LiveKit Room Name',
      validate: (value: string | string[] | null | undefined, options: { operation?: string }) => {
        if (options?.operation === 'create') return true
        if (!value || (typeof value === 'string' && value.trim().length === 0)) {
          return 'Room name is required after creation.'
        }
        return true
      },
      admin: {
        readOnly: true,
        description: 'Auto-generated on creation from course/module/lesson. Cannot be changed.',
      },
    },
    {
      name: 'hostUser',
      type: 'relationship',
      relationTo: 'payload_users',
      required: true,
      label: 'Host / Moderator',
    },
    {
      name: 'scheduledAt',
      type: 'date',
      required: true,
      label: 'Scheduled Start',
    },
    {
      name: 'capacity',
      type: 'number',
      required: true,
      defaultValue: 50,
      min: 1,
      max: 500,
      label: 'Max Participants',
    },
    {
      name: 'audience',
      type: 'select',
      required: true,
      defaultValue: 'enrolled',
      options: [
        { label: 'Members enrolled in the linked course or space', value: 'enrolled' },
        { label: 'All active members', value: 'all' },
        { label: 'Selected members', value: 'selected' },
        { label: 'Member groups', value: 'groups' },
      ],
      admin: {
        description: 'Controls who can see and join this session in the member portal.',
      },
    },
    {
      name: 'targetMemberIds',
      type: 'json',
      admin: {
        hidden: true,
        description: 'Member IDs selected by the portal administrator when audience is selected.',
      },
    },
    {
      name: 'targetGroupIds',
      type: 'json',
      admin: {
        hidden: true,
        description: 'Member group IDs selected by the portal administrator when audience is groups.',
      },
    },
    {
      name: 'categories',
      type: 'relationship',
      relationTo: 'payload_room_categories',
      hasMany: true,
      admin: {
        description: 'Optional labels for search and filtering. Categories do not grant access.',
      },
    },
    {
      name: 'archived',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Hide this Room from the active dashboard while retaining its audit and access history.',
      },
    },
    { name: 'archivedAt', type: 'date', admin: { readOnly: true } },
    {
      name: 'description',
      type: 'richText',
      label: 'Session Description',
    },
    { name: 'startedAt', type: 'date', admin: { readOnly: true } },
    { name: 'completedAt', type: 'date', admin: { readOnly: true } },
    { name: 'cancelledAt', type: 'date', admin: { readOnly: true } },
    {
      name: 'recordingUrl',
      type: 'text',
      label: 'Recording URL',
      admin: {
        readOnly: true,
        description: 'Set after an approved recording workflow completes.',
      },
    },
    {
      name: 'audit',
      type: 'json',
      label: 'Audit Log',
      admin: {
        readOnly: true,
        description: 'Persisted create, edit, and status-transition history.',
      },
    },
  ],
  timestamps: true,
}
