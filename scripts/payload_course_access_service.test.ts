import assert from 'node:assert/strict'

import {
  evaluatePayloadCourseAccess,
  evaluatePayloadLessonAccess,
  type PayloadCourseAccessAPI,
} from '../src/lib/payloadCourse/accessService'

type Doc = { id: string | number; [key: string]: unknown }

function getValue(doc: Doc, field: string) {
  return doc[field]
}

function matchesCondition(value: unknown, condition: unknown): boolean {
  if (!condition || typeof condition !== 'object') return value === condition

  const record = condition as Record<string, unknown>
  if ('equals' in record) {
    const expected = String(record.equals)
    if (Array.isArray(value)) {
      return value.some((item) => String(typeof item === 'object' && item ? (item as Doc).id : item) === expected)
    }
    return String(typeof value === 'object' && value ? (value as Doc).id : value) === expected
  }

  return false
}

function matchesWhere(doc: Doc, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((condition) => matchesWhere(doc, condition as Record<string, unknown>))
  }

  return Object.entries(where).every(([field, condition]) => {
    if (field === 'and') return true
    return matchesCondition(getValue(doc, field), condition)
  })
}

class FakePayload implements PayloadCourseAccessAPI {
  constructor(private readonly collections: Record<string, Doc[]>) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    sort?: string
  }) {
    let docs = [...(this.collections[args.collection] ?? [])].filter((doc) => matchesWhere(doc, args.where))

    if (args.sort) {
      const direction = args.sort.startsWith('-') ? -1 : 1
      const field = args.sort.replace(/^-/, '')
      docs = docs.sort((a, b) => String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * direction)
    }

    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: string | number }) {
    const doc = (this.collections[args.collection] ?? []).find((item) => String(item.id) === String(args.id))
    if (!doc) throw new Error(`missing ${args.collection}:${args.id}`)
    return doc
  }
}

function buildPayload(overrides: Partial<Record<string, Doc[]>> = {}) {
  return new FakePayload({
    payload_members: [
      { id: 'member_active', accountStatus: 'active', emailVerifiedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'member_blocked', accountStatus: 'blocked', emailVerifiedAt: '2026-01-01T00:00:00.000Z' },
    ],
    payload_access_groups: [
      { id: 'group_pro', slug: 'pro-courses', status: 'active', members: ['member_active', 'member_blocked'] },
    ],
    payload_courses: [
      { id: 'course_public', slug: 'public-course', title: 'Public Course', status: 'published', visibility: 'public' },
      { id: 'course_pro', slug: 'pro-course', title: 'Pro Course', status: 'published', visibility: 'restricted' },
      { id: 'course_draft', slug: 'draft-course', title: 'Draft Course', status: 'draft', visibility: 'public' },
    ],
    payload_course_modules: [
      { id: 'module_pro', course: 'course_pro', title: 'Pro Module', publishedPreview: true },
    ],
    payload_lessons: [
      {
        id: 'lesson_preview',
        module: 'module_pro',
        slug: 'preview-lesson',
        title: 'Preview Lesson',
        previewLesson: true,
      },
      {
        id: 'lesson_private',
        module: 'module_pro',
        slug: 'private-lesson',
        title: 'Private Lesson',
        previewLesson: false,
      },
    ],
    payload_access_policies: [
      {
        id: 'policy_pro',
        name: 'Pro course access',
        status: 'active',
        resourceType: 'course',
        resourceId: 'course_pro',
        privacy: 'private',
        allowedPlans: ['pro'],
        requiredGroups: ['group_pro'],
        requireActiveBilling: true,
        allowPreviewLessons: true,
        priority: 10,
      },
    ],
    payload_subscriptions: [
      {
        id: 'sub_pro',
        member: 'member_active',
        status: 'active',
        plan: 'pro',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'sub_blocked',
        member: 'member_blocked',
        status: 'active',
        plan: 'pro',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    payload_billing_accounts: [],
    payload_access_grants: [],
    payload_lesson_progress: [],
    ...overrides,
  })
}

async function run() {
  {
    const result = await evaluatePayloadCourseAccess(buildPayload(), {
      memberId: 'member_active',
      courseSlug: 'pro-course',
      now: '2026-01-01T00:00:00.000Z',
    })
    assert.equal(result.decision.allowed, true)
    assert.equal(result.decision.reason, 'required_group')
  }

  {
    const result = await evaluatePayloadCourseAccess(buildPayload(), {
      memberId: 'member_blocked',
      courseSlug: 'pro-course',
      now: '2026-01-01T00:00:00.000Z',
    })
    assert.equal(result.decision.allowed, false)
    assert.equal(result.decision.reason, 'account_not_active')
  }

  {
    const result = await evaluatePayloadCourseAccess(
      buildPayload({
        payload_subscriptions: [
          {
            id: 'sub_hold',
            member: 'member_active',
            status: 'past_due',
            plan: 'pro',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        payload_access_grants: [
          {
            id: 'grant_direct',
            member: 'member_active',
            resourceType: 'course',
            resourceId: 'course_pro',
            status: 'active',
          },
        ],
      }),
      {
        memberId: 'member_active',
        courseSlug: 'pro-course',
        now: '2026-01-01T00:00:00.000Z',
      }
    )
    assert.equal(result.decision.allowed, false)
    assert.equal(result.decision.reason, 'billing_not_active')
  }

  {
    const result = await evaluatePayloadCourseAccess(buildPayload(), {
      courseSlug: 'public-course',
    })
    assert.equal(result.decision.allowed, true)
    assert.equal(result.decision.reason, 'public_resource')
  }

  {
    const result = await evaluatePayloadLessonAccess(buildPayload(), {
      lessonSlug: 'preview-lesson',
    })
    assert.equal(result.decision.allowed, true)
    assert.equal(result.decision.reason, 'preview_lesson')
  }

  {
    const result = await evaluatePayloadLessonAccess(buildPayload(), {
      memberId: 'member_active',
      lessonSlug: 'private-lesson',
      requiresPreviousCompletion: true,
      previousLessonId: 'lesson_preview',
    })
    assert.equal(result.decision.allowed, false)
    assert.equal(result.decision.reason, 'previous_lesson_required')
  }
}

run()
  .then(() => {
    console.log('payload_course_access_service.test.ts passed')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
