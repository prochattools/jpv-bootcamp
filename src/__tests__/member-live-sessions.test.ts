import { describe, expect, it } from 'vitest'

import { listMemberLiveSessions } from '@/lib/liveSessions/memberSessions'
import type { PayloadCourseAccessAPI, PayloadDocument, PayloadId } from '@/lib/payloadCourse/accessService'

class FakePayload implements PayloadCourseAccessAPI {
  constructor(private readonly collections: Record<string, PayloadDocument[]>) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    depth?: number
    sort?: string
    overrideAccess?: boolean
  }) {
    if (args.collection === 'payload_course_enrollments') {
      return { docs: this.collections.payload_course_enrollments ?? [] }
    }

    if (args.collection === 'live_sessions') {
      const allowed = new Set(['course-1'])
      return {
        docs: (this.collections.live_sessions ?? []).filter((session) => {
          const course = session.course
          const courseId = typeof course === 'object' && course && 'id' in course
            ? String((course as { id: PayloadId }).id)
            : String(course)
          return allowed.has(courseId)
        }),
      }
    }

    return { docs: [] }
  }

  async findByID() {
    throw new Error('not used')
  }
}

describe('member live session discovery', () => {
  it('returns only enrolled course sessions and marks joinability safely', async () => {
    const payload = new FakePayload({
      payload_course_enrollments: [
        {
          id: 'enrollment-1',
          member: 'member-1',
          course: 'course-1',
          status: 'active',
        },
      ],
      live_sessions: [
        {
          id: 'session-live',
          title: 'Live Q&A',
          status: 'live',
          scheduledAt: '2026-07-25T10:00:00.000Z',
          roomName: 'jpv-course-course-1-module-general-lesson-general',
          course: { id: 'course-1', title: 'JPV Course' },
        },
        {
          id: 'session-scheduled',
          title: 'Next Q&A',
          status: 'scheduled',
          scheduledAt: '2026-07-26T10:00:00.000Z',
          roomName: 'jpv-course-course-1-module-general-lesson-general',
          course: { id: 'course-1', title: 'JPV Course' },
        },
        {
          id: 'session-invalid-room',
          title: 'Broken room',
          status: 'live',
          scheduledAt: '2026-07-27T10:00:00.000Z',
          roomName: 'Invalid Room!',
          course: { id: 'course-1', title: 'JPV Course' },
        },
        {
          id: 'session-other-course',
          title: 'Other course',
          status: 'live',
          scheduledAt: '2026-07-28T10:00:00.000Z',
          roomName: 'jpv-course-course-2-module-general-lesson-general',
          course: { id: 'course-2', title: 'Other Course' },
        },
      ],
    })

    const sessions = await listMemberLiveSessions(payload, 'member-1')

    expect(sessions).toHaveLength(3)
    expect(sessions.find((session) => session.id === 'session-live')).toMatchObject({
      canJoin: true,
      roomReady: true,
      courseTitle: 'JPV Course',
    })
    expect(sessions.find((session) => session.id === 'session-scheduled')?.canJoin).toBe(false)
    expect(sessions.find((session) => session.id === 'session-invalid-room')).toMatchObject({
      canJoin: false,
      roomReady: false,
    })
  })

  it('returns no sessions when the member has no active enrollments', async () => {
    const payload = new FakePayload({
      payload_course_enrollments: [],
      live_sessions: [],
    })

    await expect(listMemberLiveSessions(payload, 'member-1')).resolves.toEqual([])
  })
})
