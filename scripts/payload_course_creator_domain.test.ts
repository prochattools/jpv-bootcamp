import assert from 'node:assert/strict'

import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import type { AdminActor } from '../src/lib/auth/portalActor'
import {
  createCourseCommand,
  deleteCourseCommand,
  updateCourseCommand,
} from '../src/lib/courseAdmin/courseCommands'
import {
  createModuleCommand,
  deleteModuleCommand,
  reorderModulesCommand,
  updateModuleCommand,
} from '../src/lib/courseAdmin/moduleCommands'
import {
  archiveLessonCommand,
  createLessonCommand,
  deleteLessonCommand,
  reorderLessonsCommand,
  updateLessonCommand,
} from '../src/lib/courseAdmin/lessonCommands'
import { PortalAdminActionError } from '../src/lib/portalAdmin/actionResult'

type CollectionMap = Record<string, PayloadDocument[]>

function relationshipValue(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: PayloadId }).id)
  }
  return String(value)
}

function matchesWhere(document: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((condition) => matchesWhere(document, condition as Record<string, unknown>))
  }

  return Object.entries(where).every(([field, condition]) => {
    if (field === 'and') return true
    if (!condition || typeof condition !== 'object') return document[field] === condition
    const operator = condition as Record<string, unknown>
    const actual = relationshipValue(document[field])
    if ('equals' in operator) return actual === String(operator.equals)
    if ('not_equals' in operator) return actual !== String(operator.not_equals)
    return true
  })
}

class FakePayload implements PayloadCourseWriteAPI {
  private nextId = 1
  private updateCalls = 0

  constructor(
    private readonly collections: CollectionMap,
    private readonly throwOnUpdateCall?: number,
  ) {}

  async find(args: { collection: string; where?: Record<string, unknown>; limit?: number }) {
    const documents = (this.collections[args.collection] ?? []).filter((document) => matchesWhere(document, args.where))
    return { docs: documents.slice(0, args.limit ?? documents.length) }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    return (this.collections[args.collection] ?? []).find((document) => String(document.id) === String(args.id)) ?? null
  }

  async create(args: { collection: string; data: Record<string, unknown> }) {
    const document: PayloadDocument = {
      id: `${args.collection}-${this.nextId++}`,
      ...args.data,
    }
    this.collections[args.collection] ??= []
    this.collections[args.collection].push(document)
    return document
  }

  async update(args: { collection: string; id: PayloadId; data: Record<string, unknown> }) {
    this.updateCalls += 1
    if (this.updateCalls === this.throwOnUpdateCall) throw new Error('simulated update failure')
    const documents = this.collections[args.collection] ?? []
    const index = documents.findIndex((document) => String(document.id) === String(args.id))
    if (index < 0) throw new Error(`missing ${args.collection}:${args.id}`)
    documents[index] = { ...documents[index], ...args.data }
    return documents[index]
  }

  async delete(args: { collection: string; id: PayloadId }) {
    const documents = this.collections[args.collection] ?? []
    const index = documents.findIndex((document) => String(document.id) === String(args.id))
    if (index < 0) throw new Error(`missing ${args.collection}:${args.id}`)
    documents.splice(index, 1)
  }

  docs(collection: string): PayloadDocument[] {
    return this.collections[collection] ?? []
  }
}

const actor: AdminActor = {
  kind: 'admin',
  administratorId: 'admin-1',
  email: 'admin@example.com',
}
const access = { overrideAccess: true as const }

function context(payload: FakePayload) {
  return { payload, actor, privilegedAccess: access }
}

function basePayload(overrides: CollectionMap = {}) {
  return new FakePayload({
    payload_courses: [{ id: 'course-1', slug: 'property-training', title: 'Property Training', status: 'draft' }],
    payload_course_modules: [
      { id: 'module-1', course: 'course-1', title: 'First module', sortOrder: 0 },
      { id: 'module-2', course: { id: 'course-1' }, title: 'Second module', sortOrder: 1 },
    ],
    payload_lessons: [
      { id: 'lesson-1', module: 'module-1', slug: 'first-lesson', title: 'First lesson', sortOrder: 0 },
      { id: 'lesson-2', module: 'module-1', slug: 'second-lesson', title: 'Second lesson', sortOrder: 1 },
    ],
    payload_course_enrollments: [],
    payload_lesson_progress: [],
    payload_lesson_comments: [],
    payload_lesson_resources: [],
    payload_audit_events: [],
    ...overrides,
  })
}

async function run() {
  {
    const payload = basePayload()
    const result = await createCourseCommand(context(payload), {
      title: '  New Course  ',
      slug: 'New Course',
      description: { stale: true },
      descriptionText: 'First paragraph\n\nSecond paragraph',
      coverImage: 'media-1',
    })
    assert.equal(result.courseSlug, 'new-course')
    const course = payload.docs('payload_courses').find((document) => document.id === result.id)
    assert.equal(course?.title, 'New Course')
    assert.equal(course?.slug, 'new-course')
    assert.equal((course?.description as { root?: unknown })?.root !== undefined, true)
    assert.equal(course?.coverImage, 'media-1')
    assert.ok(payload.docs('payload_audit_events').some((event) => event.action === 'course.created'))
  }

  {
    const payload = basePayload()
    await assert.rejects(
      createCourseCommand(context(payload), { title: 'Duplicate', slug: 'property-training' }),
      (error: unknown) => error instanceof PortalAdminActionError && error.code === 'conflict',
    )
    const result = await updateCourseCommand(context(payload), 'course-1', {
      slug: 'Property Training Updated',
      status: 'published',
    })
    assert.equal(result.previousCourseSlug, 'property-training')
    assert.equal(result.courseSlug, 'property-training-updated')
    assert.equal(payload.docs('payload_courses')[0].status, 'published')
    assert.ok(payload.docs('payload_audit_events').some((event) => event.action === 'course.updated'))
  }

  {
    const payload = basePayload()
    const created = await createModuleCommand(context(payload), {
      courseId: 'course-1',
      title: '  New module  ',
      description: 'A module',
    })
    assert.equal(created.courseSlug, 'property-training')
    assert.equal(payload.docs('payload_course_modules').find((document) => document.id === created.id)?.title, 'New module')
    await updateModuleCommand(context(payload), 'module-1', { title: 'Updated module', publishedPreview: false })
    assert.equal(payload.docs('payload_course_modules').find((document) => document.id === 'module-1')?.publishedPreview, false)
    assert.ok(payload.docs('payload_audit_events').some((event) => event.action === 'module.updated'))
  }

  {
    const payload = basePayload()
    await reorderModulesCommand(context(payload), 'course-1', ['module-2', 'module-1'])
    assert.equal(payload.docs('payload_course_modules').find((document) => document.id === 'module-2')?.sortOrder, 0)
    assert.equal(payload.docs('payload_course_modules').find((document) => document.id === 'module-1')?.sortOrder, 1)
    await assert.rejects(
      reorderModulesCommand(context(payload), 'course-1', ['module-2', 'module-2']),
      (error: unknown) => error instanceof PortalAdminActionError && error.code === 'invalid_input',
    )
    assert.ok(payload.docs('payload_audit_events').some((event) => event.action === 'modules.reordered'))
  }

  {
    const payload = new FakePayload({
      payload_courses: [{ id: 'course-1', slug: 'property-training' }],
      payload_course_modules: [
        { id: 'module-1', course: 'course-1', sortOrder: 0 },
        { id: 'module-2', course: 'course-1', sortOrder: 1 },
      ],
      payload_audit_events: [],
    }, 2)
    await assert.rejects(
      reorderModulesCommand(context(payload), 'course-1', ['module-2', 'module-1']),
      (error: unknown) => error instanceof PortalAdminActionError && error.code === 'conflict',
    )
    assert.equal(payload.docs('payload_course_modules').find((document) => document.id === 'module-1')?.sortOrder, 0)
    assert.equal(payload.docs('payload_course_modules').find((document) => document.id === 'module-2')?.sortOrder, 1)
  }

  {
    const payload = basePayload()
    await assert.rejects(
      deleteModuleCommand(context(payload), 'module-1', true),
      (error: unknown) => error instanceof PortalAdminActionError && error.code === 'dependency_blocked',
    )
    const created = await createLessonCommand(context(payload), {
      moduleId: 'module-1',
      title: '  New lesson  ',
      slug: 'New Lesson',
      content: { stale: true },
      contentText: 'Lesson text',
      bunnyVideo: 'bunny-video-1',
      downloads: ['resource-1'],
    })
    assert.equal(created.courseSlug, 'property-training')
    const lesson = payload.docs('payload_lessons').find((document) => document.id === created.id)
    assert.equal(lesson?.slug, 'new-lesson')
    assert.equal(lesson?.bunnyVideo, 'bunny-video-1')
    assert.equal((lesson?.content as { root?: unknown })?.root !== undefined, true)
    await updateLessonCommand(context(payload), String(created.id), { summary: 'Summary' })
    await archiveLessonCommand(context(payload), String(created.id))
    assert.equal(payload.docs('payload_lessons').find((document) => document.id === created.id)?.lockState, 'locked')
    assert.ok(payload.docs('payload_audit_events').some((event) => event.action === 'lesson.created'))
    assert.ok(payload.docs('payload_audit_events').some((event) => event.action === 'lesson.updated'))
  }

  {
    const payload = basePayload()
    await reorderLessonsCommand(context(payload), 'module-1', ['lesson-2', 'lesson-1'])
    assert.equal(payload.docs('payload_lessons').find((document) => document.id === 'lesson-2')?.sortOrder, 0)
    payload.docs('payload_lesson_progress').push({ id: 'progress-1', lesson: 'lesson-1' })
    await assert.rejects(
      deleteLessonCommand(context(payload), 'lesson-1', true),
      (error: unknown) => error instanceof PortalAdminActionError && error.code === 'dependency_blocked',
    )
    payload.docs('payload_lesson_progress').splice(0, 1)
    await deleteLessonCommand(context(payload), 'lesson-1', true)
    assert.equal(payload.docs('payload_lessons').some((document) => document.id === 'lesson-1'), false)
  }

  {
    const payload = basePayload({
      payload_course_modules: [],
      payload_course_enrollments: [{ id: 'enrol-1', course: 'course-1' }],
    })
    await assert.rejects(
      deleteCourseCommand(context(payload), 'course-1', true),
      (error: unknown) => error instanceof PortalAdminActionError && error.code === 'dependency_blocked',
    )
    payload.docs('payload_course_enrollments').splice(0, 1)
    await deleteCourseCommand(context(payload), 'course-1', true)
    assert.equal(payload.docs('payload_courses').length, 0)
    assert.ok(payload.docs('payload_audit_events').some((event) => event.action === 'course.deleted'))
  }

  console.log('payload course creator domain tests passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
