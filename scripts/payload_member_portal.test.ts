import assert from 'node:assert/strict'

import { PayloadMemberProfiles } from '../src/collections/members/Members'
import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
  PayloadId,
  PayloadCourseWriteAPI,
} from '../src/lib/payloadCourse/accessService'
import {
  getMemberAccountOverview,
  getMemberCourseDashboard,
  getMemberCourseOverview,
  getMemberLessonDetail,
  markMemberLessonComplete,
} from '../src/lib/payloadCourse/memberPortal'

type CollectionMap = Record<string, PayloadDocument[]>

function relationValue(value: unknown) {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: PayloadId }).id)
  }
  return String(value)
}

function matchesCondition(value: unknown, condition: unknown): boolean {
  if (!condition || typeof condition !== 'object') return value === condition
  const record = condition as Record<string, unknown>

  if ('equals' in record) {
    const expected = String(record.equals)
    if (Array.isArray(value)) return value.some((item) => relationValue(item) === expected)
    return relationValue(value) === expected
  }

  return false
}

function matchesWhere(doc: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((condition) => matchesWhere(doc, condition as Record<string, unknown>))
  }

  return Object.entries(where).every(([field, condition]) => {
    if (field === 'and') return true
    return matchesCondition(doc[field], condition)
  })
}

class FakePayload implements PayloadCourseWriteAPI {
  readonly findCalls: Array<{ collection: string; where?: Record<string, unknown> }> = []
  private nextId = 100

  constructor(private readonly collections: CollectionMap) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    sort?: string
  }) {
    this.findCalls.push({ collection: args.collection, where: args.where })
    let docs = [...(this.collections[args.collection] ?? [])].filter((doc) => matchesWhere(doc, args.where))
    if (args.sort) {
      const direction = args.sort.startsWith('-') ? -1 : 1
      const field = args.sort.replace(/^-/, '')
      docs = docs.sort((a, b) => {
        const aValue = a[field]
        const bValue = b[field]
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return (aValue - bValue) * direction
        }
        return String(aValue ?? '').localeCompare(String(bValue ?? '')) * direction
      })
    }
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const doc = (this.collections[args.collection] ?? []).find((item) => String(item.id) === String(args.id))
    if (!doc) throw new Error(`missing ${args.collection}:${args.id}`)
    return doc
  }

  async create(args: { collection: string; data: Record<string, unknown> }) {
    const doc = {
      id: `${args.collection}_${this.nextId++}`,
      ...args.data,
    }
    this.collections[args.collection] = this.collections[args.collection] ?? []
    this.collections[args.collection].push(doc)
    return doc
  }

  async update(args: { collection: string; id: PayloadId; data: Record<string, unknown> }) {
    const docs = this.collections[args.collection] ?? []
    const index = docs.findIndex((doc) => String(doc.id) === String(args.id))
    if (index < 0) throw new Error(`missing ${args.collection}:${args.id}`)
    docs[index] = {
      ...docs[index],
      ...args.data,
    }
    return docs[index]
  }

  docs(collection: string) {
    return this.collections[collection] ?? []
  }
}

function buildPayload() {
  return new FakePayload({
    payload_members: [
      {
        id: 'member_active',
        email: 'student@example.com',
        accountStatus: 'active',
        emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    payload_courses: [
      {
        id: 'course_foundations',
        title: 'Foundations',
        slug: 'foundations',
        status: 'published',
        visibility: 'members',
        accessBadge: 'free',
        shortDescription: 'Member course',
        estimatedDuration: '2 hours',
        sortOrder: 10,
      },
      {
        id: 'course_pro',
        title: 'Pro Lab',
        slug: 'pro-lab',
        status: 'published',
        visibility: 'restricted',
        accessBadge: 'pro',
        shortDescription: 'Pro course',
        estimatedDuration: '5 hours',
        sortOrder: 20,
      },
      {
        id: 'course_vip',
        title: 'VIP Lab',
        slug: 'vip-lab',
        status: 'published',
        visibility: 'restricted',
        accessBadge: 'vip',
        shortDescription: 'VIP course',
        estimatedDuration: '6 hours',
        sortOrder: 30,
      },
    ],
    payload_access_policies: [
      {
        id: 'policy_foundations',
        resourceType: 'course',
        resourceId: 'course_foundations',
        status: 'active',
        privacy: 'members',
        requireActiveBilling: false,
        priority: 10,
      },
      {
        id: 'policy_pro',
        resourceType: 'course',
        resourceId: 'course_pro',
        status: 'active',
        privacy: 'private',
        allowedPlans: ['pro', 'vip'],
        requiredGroups: ['group_pro'],
        requireActiveBilling: true,
        priority: 20,
      },
      {
        id: 'policy_vip',
        resourceType: 'course',
        resourceId: 'course_vip',
        status: 'active',
        privacy: 'secret',
        allowedPlans: ['vip'],
        requireActiveBilling: true,
        priority: 30,
      },
    ],
    payload_access_groups: [
      {
        id: 'group_pro',
        name: 'Pro Courses',
        slug: 'pro-courses',
        status: 'active',
        members: ['member_active'],
      },
    ],
    payload_access_grants: [],
    payload_billing_accounts: [
      {
        id: 'billing_1',
        member: 'member_active',
        billingStatus: 'active',
        stripeMode: 'test',
        updatedAt: '2026-01-04T00:00:00.000Z',
      },
    ],
    payload_subscriptions: [
      {
        id: 'subscription_1',
        member: 'member_active',
        status: 'active',
        plan: 'pro',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-01-05T00:00:00.000Z',
      },
    ],
    payload_course_modules: [
      { id: 'module_foundations', course: 'course_foundations', title: 'Start Here', sortOrder: 10 },
      { id: 'module_pro', course: 'course_pro', title: 'Systems', sortOrder: 10 },
      { id: 'module_vip', course: 'course_vip', title: 'Private Track', sortOrder: 10 },
    ],
    payload_lessons: [
      {
        id: 'lesson_foundations_1',
        module: 'module_foundations',
        title: 'Welcome',
        slug: 'welcome',
        estimatedDuration: '8 min',
        sortOrder: 10,
      },
      {
        id: 'lesson_foundations_2',
        module: 'module_foundations',
        title: 'Principles',
        slug: 'principles',
        estimatedDuration: '14 min',
        sortOrder: 20,
      },
      {
        id: 'lesson_foundations_3',
        module: 'module_foundations',
        title: 'Advanced Step',
        slug: 'advanced-step',
        estimatedDuration: '16 min',
        sortOrder: 30,
      },
      {
        id: 'lesson_pro_1',
        module: 'module_pro',
        title: 'Pro Preview',
        slug: 'pro-preview',
        estimatedDuration: '7 min',
        sortOrder: 10,
      },
      {
        id: 'lesson_vip_1',
        module: 'module_vip',
        title: 'VIP Secret Lesson',
        slug: 'vip-secret',
        estimatedDuration: '12 min',
        sortOrder: 10,
      },
    ],
    payload_lesson_progress: [
      {
        id: 'progress_1',
        member: 'member_active',
        lesson: 'lesson_foundations_1',
        status: 'completed',
      },
    ],
    payload_member_profiles: [
      {
        id: 'profile_1',
        member: 'member_active',
        displayName: 'Student Example',
        timezone: 'Europe/Lisbon',
        phone: '+351 000 000 000',
        company: 'JPV Test',
      },
    ],
  })
}

async function run() {
  {
    const profileRead = PayloadMemberProfiles.access?.read
    assert.equal(typeof profileRead, 'function')
    const result = await profileRead?.({
      req: {
        user: {
          id: 'member_active',
          collection: 'payload_members',
        },
      },
    } as any)

    assert.deepEqual(result, {
      member: {
        equals: 'member_active',
      },
    })
  }

  {
    const payload = buildPayload()
    const dashboard = await getMemberCourseDashboard(payload, 'member_active')

    assert.equal(dashboard.courses.length, 3)
    assert.equal(dashboard.continueLesson?.lessonTitle, 'Principles')

    const foundations = dashboard.courses.find((course) => course.id === 'course_foundations')
    assert.equal(foundations?.allowed, true)
    assert.equal(foundations?.lessonCount, 3)
    assert.equal(foundations?.completedLessonCount, 1)
    assert.equal(foundations?.progressPercent, 33)

    const pro = dashboard.courses.find((course) => course.id === 'course_pro')
    assert.equal(pro?.allowed, true)
    assert.equal(pro?.decisionReason, 'required_group')
    assert.equal(pro?.lessonCount, 1)

    const vip = dashboard.courses.find((course) => course.id === 'course_vip')
    assert.equal(vip?.allowed, false)
    assert.equal(vip?.modules.length, 0)
    assert.equal(vip?.lessonCount, null)
    assert.match(vip?.lockReason ?? '', /does not currently include/)

    const vipLessonFetch = payload.findCalls.find((call) => {
      return (
        call.collection === 'payload_lessons' &&
        JSON.stringify(call.where).includes('module_vip')
      )
    })
    assert.equal(vipLessonFetch, undefined)
  }

  {
    const payload = buildPayload()
    const overview = await getMemberCourseOverview(payload, 'member_active', 'pro-lab')

    assert.equal(overview?.allowed, true)
    assert.equal(overview?.modules[0]?.lessons[0]?.title, 'Pro Preview')
  }

  {
    const payload = buildPayload()
    const overview = await getMemberCourseOverview(payload, 'member_active', 'vip-lab')

    assert.equal(overview?.allowed, false)
    assert.equal(overview?.modules.length, 0)

    const vipLessonFetch = payload.findCalls.find((call) => {
      return (
        call.collection === 'payload_lessons' &&
        JSON.stringify(call.where).includes('module_vip')
      )
    })
    assert.equal(vipLessonFetch, undefined)
  }

  {
    const payload = buildPayload()
    const detail = await getMemberLessonDetail(payload, 'member_active', 'foundations', 'principles')

    assert.equal(detail?.allowed, true)
    assert.equal(detail?.lesson?.title, 'Principles')
    assert.equal(detail?.previousLesson?.completed, true)
    assert.equal(detail?.nextLesson?.slug, 'advanced-step')
  }

  {
    const payload = buildPayload()
    const detail = await getMemberLessonDetail(payload, 'member_active', 'foundations', 'advanced-step')

    assert.equal(detail?.allowed, false)
    assert.equal(detail?.decisionReason, 'previous_lesson_required')
    assert.equal(detail?.lesson?.title, null)
    assert.equal(detail?.lesson?.summary, null)
  }

  {
    const payload = buildPayload()

    await markMemberLessonComplete(payload, 'member_active', 'lesson_foundations_2', 'Principles')
    assert.equal(payload.docs('payload_lesson_progress').length, 2)
    const created = payload
      .docs('payload_lesson_progress')
      .find((doc) => doc.lesson === 'lesson_foundations_2')
    assert.equal(created?.status, 'completed')
    assert.equal(created?.percentComplete, 100)

    await markMemberLessonComplete(payload, 'member_active', 'lesson_foundations_2', 'Principles')
    assert.equal(payload.docs('payload_lesson_progress').length, 2)
  }

  {
    const payload = buildPayload()
    const account = await getMemberAccountOverview(payload, 'member_active')

    assert.equal(account.profile?.displayName, 'Student Example')
    assert.equal(account.billingAccount?.billingStatus, 'active')
    assert.equal(account.subscriptions[0]?.plan, 'pro')
    assert.equal(account.groups[0]?.slug, 'pro-courses')
  }
}

run()
  .then(() => {
    console.log('payload_member_portal.test.ts passed')
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
