import type { CollectionConfig } from 'payload'

import {
  assertLiveSessionRelationships,
  liveSessionRelationshipId,
  prepareLiveSessionMutation,
  type LiveSessionDocument,
} from '@/lib/liveSessions/sessionLifecycle'

export const PayloadLiveSession: CollectionConfig = {
  slug: 'live_sessions',
  dbName: 'live_sessions',
  labels: {
    singular: 'Live Session',
    plural: 'Live Sessions',
  },
  admin: {
    group: 'Courses',
    useAsTitle: 'title',
    defaultColumns: ['title', 'status', 'scheduledAt', 'course', 'hostUser', 'updatedAt'],
    description: 'Schedule and operate LiveKit sessions. Room names and audit history are generated automatically.',
  },
  access: {
    read: async ({ req }) => {
      if (req.user?.collection === 'payload_users') return true
      if (req.user?.collection !== 'payload_members') return false

      const enrollments = await req.payload.find({
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
      })
      const courseIds = enrollments.docs
        .map((enrollment) => liveSessionRelationshipId(enrollment.course))
        .filter((id): id is string => Boolean(id))

      return courseIds.length > 0 ? { course: { in: courseIds } } : false
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
        await assertLiveSessionRelationships({
          payload: req.payload,
          course: merged.course,
          module: merged.module,
          lesson: merged.lesson,
        })

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
      required: true,
      label: 'Course',
    },
    {
      name: 'module',
      type: 'relationship',
      relationTo: 'payload_course_modules',
      label: 'Module',
      admin: {
        description: 'Optional. Must belong to the selected course.',
      },
    },
    {
      name: 'lesson',
      type: 'relationship',
      relationTo: 'payload_lessons',
      label: 'Lesson',
      admin: {
        description: 'Optional. Requires a module and must belong to it.',
      },
    },
    {
      name: 'roomName',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'LiveKit Room Name',
      admin: {
        readOnly: true,
        description: 'Generated from the immutable course/module/lesson relationship path.',
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
