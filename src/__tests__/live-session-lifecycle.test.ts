import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  assertLiveSessionRelationships,
  assertLiveSessionStatusTransition,
  generateLiveSessionRoomName,
  isValidLiveSessionRoomName,
  prepareLiveSessionMutation,
} from '@/lib/liveSessions/sessionLifecycle'

describe('Live Session lifecycle', () => {
  it('generates deterministic valid room names from relationship IDs', () => {
    const roomName = generateLiveSessionRoomName({
      courseId: 'Course 101',
      moduleId: 'Module/2',
      lessonId: 'Lesson:3',
    })

    expect(roomName).toBe('jpv-course-course-101-module-module-2-lesson-lesson-3')
    expect(isValidLiveSessionRoomName(roomName)).toBe(true)
    expect(isValidLiveSessionRoomName('Invalid Room!')).toBe(false)
    expect(isValidLiveSessionRoomName('')).toBe(false)
  })

  it('creates scheduled sessions with persisted audit and immutable room names', () => {
    const created = prepareLiveSessionMutation({
      operation: 'create',
      data: {
        title: 'Weekly Q&A',
        course: 'course-1',
        module: 'module-1',
        lesson: 'lesson-1',
        scheduledAt: '2026-07-25T10:00:00.000Z',
      },
      operatorId: 'admin-1',
      now: new Date('2026-07-24T10:00:00.000Z'),
    })

    expect(created.status).toBe('scheduled')
    expect(created.roomName).toBe('jpv-course-course-1-module-module-1-lesson-lesson-1')
    expect(created.audit).toEqual([
      {
        event: 'created',
        timestamp: '2026-07-24T10:00:00.000Z',
        operator: 'admin-1',
        toStatus: 'scheduled',
      },
    ])
  })

  it('records actual edits and status changes exactly once', () => {
    const original = {
      id: 'session-1',
      title: 'Weekly Q&A',
      status: 'scheduled' as const,
      course: 'course-1',
      roomName: 'jpv-course-course-1-module-general-lesson-general',
      scheduledAt: '2026-07-25T10:00:00.000Z',
      capacity: 50,
      audit: [],
    }

    const started = prepareLiveSessionMutation({
      operation: 'update',
      data: { status: 'live' },
      originalDoc: original,
      operatorId: 'admin-1',
      now: new Date('2026-07-25T10:00:00.000Z'),
    })
    expect(started.startedAt).toBe('2026-07-25T10:00:00.000Z')
    expect(started.audit).toEqual([
      expect.objectContaining({
        event: 'status_changed',
        fromStatus: 'scheduled',
        toStatus: 'live',
        changedFields: ['status'],
      }),
    ])

    const idempotent = prepareLiveSessionMutation({
      operation: 'update',
      data: { status: 'scheduled' },
      originalDoc: original,
      operatorId: 'admin-1',
    })
    expect(idempotent.audit).toEqual([])
  })

  it('rejects invalid transitions, terminal edits, and room changes', () => {
    expect(() => assertLiveSessionStatusTransition('scheduled', 'completed')).toThrow(
      'cannot transition from scheduled to completed',
    )

    const completed = {
      id: 'session-1',
      title: 'Done',
      status: 'completed' as const,
      course: 'course-1',
      roomName: 'jpv-course-course-1-module-general-lesson-general',
      audit: [],
    }
    expect(() =>
      prepareLiveSessionMutation({
        operation: 'update',
        data: { title: 'Changed' },
        originalDoc: completed,
      }),
    ).toThrow('completed live sessions are immutable')

    expect(() =>
      prepareLiveSessionMutation({
        operation: 'update',
        data: { roomName: 'jpv-other-room' },
        originalDoc: { ...completed, status: 'live' },
      }),
    ).toThrow('Room name cannot be changed')
  })

  it('validates course, module, and lesson relationship integrity', async () => {
    const payload = {
      async findByID(args: { collection: string; id: string | number }) {
        if (args.collection === 'payload_courses') return { id: args.id }
        if (args.collection === 'payload_course_modules') {
          return { id: args.id, course: 'course-1' }
        }
        return { id: args.id, module: 'module-1' }
      },
    }

    await expect(
      assertLiveSessionRelationships({
        payload,
        course: 'course-1',
        module: 'module-1',
        lesson: 'lesson-1',
      }),
    ).resolves.toBeUndefined()

    await expect(
      assertLiveSessionRelationships({
        payload,
        course: 'course-1',
        lesson: 'lesson-1',
      }),
    ).rejects.toThrow('requires its module')

    await expect(
      assertLiveSessionRelationships({
        payload: {
          ...payload,
          async findByID(args) {
            if (args.collection === 'payload_course_modules') {
              return { id: args.id, course: 'other-course' }
            }
            return payload.findByID(args)
          },
        },
        course: 'course-1',
        module: 'module-1',
      }),
    ).rejects.toThrow('does not belong to the selected course')
  })

  it('wires Payload relationships, audit hooks, and complete admin controls', () => {
    const collection = readFileSync(resolve('src/collections/PayloadLiveSession.ts'), 'utf8')
    const adminPage = readFileSync(resolve('src/app/admin/sessions/page.tsx'), 'utf8')
    const createRoute = readFileSync(resolve('src/app/api/admin/sessions/route.ts'), 'utf8')

    expect(collection).toContain("relationTo: 'payload_course_modules'")
    expect(collection).toContain("relationTo: 'payload_lessons'")
    expect(collection).toContain('prepareLiveSessionMutation')
    expect(collection).toContain('assertLiveSessionRelationships')
    expect(adminPage).toContain('Start')
    expect(adminPage).toContain('Complete')
    expect(adminPage).toContain('Join as host')
    expect(adminPage).toContain('/admin/collections/live_sessions/')
    expect(createRoute).toContain('hostUser: session.administratorId')
    expect(createRoute).not.toContain('body.hostUser')
  })
})
