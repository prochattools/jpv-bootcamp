import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
} from '../src/lib/payloadCourse/accessService'
import {
  getMemberCourseOverview,
} from '../src/lib/payloadCourse/memberPortal'
import { getMemberResourceLibrary } from '../src/lib/payloadCourse/resourceLibrary'
import {
  resolveMemberLessonResourceDownload,
} from '../src/lib/payloadCourse/lessonResources'
import {
  getMemberCommunitySpaceDetail,
} from '../src/lib/payloadCourse/communityPortal'
import {
  resolveMemberCommunityPostAttachments,
} from '../src/lib/payloadCourse/communityDiscussion'

type CollectionMap = Record<string, PayloadDocument[]>

function relationId(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: unknown }).id)
  }
  return String(value)
}

function matchesCondition(value: unknown, condition: unknown): boolean {
  if (!condition || typeof condition !== 'object') return value === condition
  const record = condition as Record<string, unknown>

  if ('equals' in record) {
    const expected = String(record.equals)
    if (Array.isArray(value)) return value.some((item) => relationId(item) === expected)
    return relationId(value) === expected
  }

  if ('in' in record && Array.isArray(record.in)) {
    const expected = new Set(record.in.map(String))
    if (Array.isArray(value)) return value.some((item) => expected.has(relationId(item)))
    return expected.has(relationId(value))
  }

  return false
}

function matchesWhere(doc: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((condition) => matchesWhere(doc, condition as Record<string, unknown>))
  }

  return Object.entries(where).every(([field, condition]) => matchesCondition(doc[field], condition))
}

class FakePayload implements PayloadCourseAccessAPI {
  constructor(private readonly collections: CollectionMap) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    sort?: string
  }) {
    let docs = [...(this.collections[args.collection] ?? [])].filter((doc) =>
      matchesWhere(doc, args.where),
    )

    if (args.sort) {
      const direction = args.sort.startsWith('-') ? -1 : 1
      const field = args.sort.replace(/^-/, '')
      docs.sort((a, b) => {
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

  async findByID(args: { collection: string; id: string | number }) {
    const document = (this.collections[args.collection] ?? []).find(
      (item) => String(item.id) === String(args.id),
    )
    if (!document) throw new Error(`missing ${args.collection}:${args.id}`)
    return document
  }
}

function textBody(text: string) {
  return {
    root: {
      type: 'root',
      children: [{ type: 'paragraph', children: [{ type: 'text', text }] }],
    },
  }
}

function buildPayload(): FakePayload {
  return new FakePayload({
    payload_members: [
      {
        id: 'member_entitled',
        displayName: 'Entitled Member',
        email: 'entitled@example.com',
        accountStatus: 'active',
        emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'member_unentitled',
        displayName: 'Unentitled Member',
        email: 'unentitled@example.com',
        accountStatus: 'active',
        emailVerifiedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    payload_access_groups: [
      {
        id: 'group_entitled',
        status: 'active',
        members: ['member_entitled'],
      },
    ],
    payload_subscriptions: [
      {
        id: 'subscription_entitled',
        member: 'member_entitled',
        status: 'active',
        updatedAt: '2026-01-02T00:00:00.000Z',
      },
    ],
    payload_billing_accounts: [],
    payload_access_grants: [],
    payload_courses: [
      {
        id: 'course_entitled',
        title: 'Entitled Course',
        slug: 'entitled-course',
        status: 'published',
        visibility: 'private',
        shortDescription: 'Published course summary.',
        description: textBody('Published course description.'),
        estimatedDuration: '90 minutes',
        accessBadge: 'Included',
        sortOrder: 10,
      },
      {
        id: 'course_locked',
        title: 'Locked Course',
        slug: 'locked-course',
        status: 'published',
        visibility: 'private',
        shortDescription: 'Locked course summary.',
        description: textBody('Locked course description.'),
        sortOrder: 20,
      },
      {
        id: 'course_draft',
        title: 'Draft Course',
        slug: 'draft-course',
        status: 'draft',
        visibility: 'private',
        shortDescription: 'Administrative draft summary.',
        description: textBody('Administrative draft description.'),
        sortOrder: 30,
      },
    ],
    payload_access_policies: [
      {
        id: 'policy_entitled_course',
        resourceType: 'course',
        resourceId: 'course_entitled',
        status: 'active',
        privacy: 'private',
        requiredGroups: ['group_entitled'],
        requireActiveBilling: true,
        priority: 10,
      },
      {
        id: 'policy_locked_course',
        resourceType: 'course',
        resourceId: 'course_locked',
        status: 'active',
        privacy: 'private',
        requiredGroups: ['group_entitled'],
        requireActiveBilling: true,
        priority: 20,
      },
      {
        id: 'policy_announcement_space',
        resourceType: 'space',
        resourceId: 'space_announcement',
        status: 'active',
        privacy: 'private',
        requiredGroups: ['group_entitled'],
        requireActiveBilling: true,
        priority: 30,
      },
    ],
    payload_course_modules: [
      {
        id: 'module_entitled',
        course: 'course_entitled',
        title: 'Published Module',
        description: 'Module description.',
        sortOrder: 10,
        publishedPreview: true,
      },
      {
        id: 'module_locked',
        course: 'course_locked',
        title: 'Locked Module',
        sortOrder: 10,
        publishedPreview: true,
      },
      {
        id: 'module_draft',
        course: 'course_draft',
        title: 'Draft Module',
        sortOrder: 10,
        publishedPreview: false,
      },
    ],
    payload_lessons: [
      {
        id: 'lesson_entitled',
        module: 'module_entitled',
        title: 'Published Lesson',
        slug: 'published-lesson',
        summary: 'Lesson summary.',
        sortOrder: 10,
        lockState: 'available',
      },
      {
        id: 'lesson_locked',
        module: 'module_locked',
        title: 'Locked Lesson',
        slug: 'locked-lesson',
        sortOrder: 10,
        lockState: 'locked',
      },
      {
        id: 'lesson_draft',
        module: 'module_draft',
        title: 'Draft Lesson',
        slug: 'draft-lesson',
        sortOrder: 10,
      },
    ],
    payload_lesson_progress: [],
    payload_lesson_resources: [
      {
        id: 'resource_entitled',
        lesson: 'lesson_entitled',
        protectedFile: 'private_resource_entitled',
        title: 'Published Workbook',
        status: 'published',
        sortOrder: 10,
      },
      {
        id: 'resource_locked',
        lesson: 'lesson_locked',
        protectedFile: 'private_resource_locked',
        title: 'Locked Workbook',
        status: 'published',
        sortOrder: 10,
      },
      {
        id: 'resource_draft',
        lesson: 'lesson_entitled',
        protectedFile: 'private_resource_entitled',
        title: 'Unpublished Workbook',
        status: 'draft',
        sortOrder: 20,
      },
    ],
    payload_private_media: [
      {
        id: 'private_resource_entitled',
        filename: 'published-workbook.pdf',
        mimeType: 'application/pdf',
        filesize: 2048,
      },
      {
        id: 'private_resource_locked',
        filename: 'locked-workbook.pdf',
        mimeType: 'application/pdf',
        filesize: 2048,
      },
      {
        id: 'private_announcement_image',
        filename: 'announcement.png',
        mimeType: 'image/png',
        filesize: 4096,
      },
    ],
    payload_media: [],
    payload_spaces: [
      {
        id: 'space_announcement',
        name: 'Member Announcements',
        slug: 'member-announcements',
        status: 'published',
        spaceType: 'announcement',
        visibility: 'private',
        sortOrder: 10,
      },
    ],
    payload_space_memberships: [],
    payload_space_posts: [
      {
        id: 'post_announcement',
        title: 'Announcement with media',
        space: 'space_announcement',
        author: 'member_entitled',
        postType: 'announcement',
        moderationStatus: 'visible',
        pinned: true,
        createdAt: '2026-01-03T00:00:00.000Z',
        body: textBody('Announcement body.'),
      },
    ],
    payload_space_comments: [],
    payload_space_files: [
      {
        id: 'file_announcement_image',
        title: 'Announcement image',
        space: 'space_announcement',
        post: 'post_announcement',
        attachmentType: 'image',
        altText: 'Announcement visual',
        protectedFile: 'private_announcement_image',
        moderationStatus: 'visible',
        sortOrder: 10,
      },
    ],
  })
}

function source(path: string): string {
  return readFileSync(path, 'utf8')
}

async function run(): Promise<void> {
  const payload = buildPayload()

  const entitledCourse = await getMemberCourseOverview(payload, 'member_entitled', 'entitled-course')
  assert.equal(entitledCourse?.allowed, true)
  assert.equal(entitledCourse?.title, 'Entitled Course')
  assert.equal(entitledCourse?.shortDescription, 'Published course summary.')
  assert.equal(entitledCourse?.description, 'Published course description.')
  assert.equal(entitledCourse?.modules[0]?.lessons[0]?.summary, 'Lesson summary.')

  const unentitledCourse = await getMemberCourseOverview(payload, 'member_unentitled', 'locked-course')
  assert.equal(unentitledCourse?.allowed, false)
  assert.deepEqual(unentitledCourse?.modules, [])
  assert.equal(unentitledCourse?.lessonCount, null)

  const entitledResources = await getMemberResourceLibrary(payload, 'member_entitled')
  assert.deepEqual(
    entitledResources.flatMap((group) => group.resources.map((resource) => resource.id)),
    ['resource_entitled'],
  )

  const unentitledResources = await getMemberResourceLibrary(payload, 'member_unentitled')
  assert.deepEqual(unentitledResources, [])

  const entitledDownload = await resolveMemberLessonResourceDownload(
    payload,
    'member_entitled',
    'resource_entitled',
  )
  assert.equal(entitledDownload.allowed, true)

  const unentitledDownload = await resolveMemberLessonResourceDownload(
    payload,
    'member_unentitled',
    'resource_locked',
  )
  assert.deepEqual(unentitledDownload, {
    allowed: false,
    reason: 'access_denied',
    decisionReason: 'billing_not_active',
  })

  const administratorDownload = await resolveMemberLessonResourceDownload(
    payload,
    'administrator_1',
    'resource_locked',
    { allowAdministrator: true },
  )
  assert.equal(administratorDownload.allowed, true)

  const entitledCommunity = await getMemberCommunitySpaceDetail(
    payload,
    'member_entitled',
    'member-announcements',
  )
  assert.equal(entitledCommunity?.allowed, true)
  assert.equal(entitledCommunity?.posts[0]?.title, 'Announcement with media')
  assert.equal(entitledCommunity?.posts[0]?.attachments[0]?.id, 'file_announcement_image')
  const entitledPreview = entitledCommunity?.posts[0]?.attachments[0]
  assert.equal(
    entitledPreview && 'previewUrl' in entitledPreview ? entitledPreview.previewUrl : undefined,
    '/portal/community/files/file_announcement_image?inline=1',
  )

  const unentitledCommunity = await getMemberCommunitySpaceDetail(
    payload,
    'member_unentitled',
    'member-announcements',
  )
  assert.equal(unentitledCommunity?.allowed, false)
  assert.deepEqual(unentitledCommunity?.posts, [])

  const adminAttachments = await resolveMemberCommunityPostAttachments(
    payload,
    'administrator_1',
    'post_announcement',
    { allowAdministrator: true },
  )
  assert.equal(adminAttachments[0]?.id, 'file_announcement_image')

  const unentitledAttachments = await resolveMemberCommunityPostAttachments(
    payload,
    'member_unentitled',
    'post_announcement',
  )
  assert.deepEqual(unentitledAttachments, [])

  const coursePage = source('src/app/(frontend)/portal/courses/[courseSlug]/page.tsx')
  const courseListPage = source('src/app/(frontend)/portal/courses/page.tsx')
  const adminPortal = source('src/lib/portalAdmin/adminPortal.ts')
  assert.match(coursePage, /requirePortalAccess\(requestedPath\)/)
  assert.match(coursePage, /getAdminCourseOverview\(payload, courseSlug\)/)
  assert.match(coursePage, /getMemberCourseOverview\(payload, memberId, courseSlug\)/)
  assert.match(coursePage, /course\.title/)
  assert.match(coursePage, /course\.shortDescription/)
  assert.match(coursePage, /CourseModuleAccordion/)
  assert.match(courseListPage, /getAdminCourseDashboard\(payload\)/)
  assert.match(courseListPage, /Viewing all courses including draft and archived/)
  assert.match(adminPortal, /getAdminCourseOverview/)
  assert.match(adminPortal, /descriptionPlainText: extractPlainText\(course\.description\)/)
  assert.match(adminPortal, /getAdminCourseModules\(payload, course\.id\)/)

  const resourcesPage = source('src/app/(frontend)/portal/resources/page.tsx')
  assert.match(resourcesPage, /getAdminResourceLibrary\(payload\)/)
  assert.match(resourcesPage, /getMemberResourceLibrary\(payload, memberId\)/)
  assert.match(resourcesPage, /resource\.downloadUrl/)
  assert.match(adminPortal, /listPublishedLessonResources\(payload, lesson\.id\)/)

  const communityPage = source('src/app/(frontend)/portal/community/[spaceSlug]/page.tsx')
  assert.match(communityPage, /getMemberCommunitySpaceDetail/)
  assert.match(communityPage, /resolveMemberCommunityPostAttachments/)
  assert.match(communityPage, /allowAdministrator: true/)

  const communityPostPage = source('src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx')
  assert.match(communityPostPage, /resolveMemberCommunityAttachment/)
  assert.match(communityPostPage, /imagePreviewUrl/)

  const communityCard = source('src/components/community/CommunityPostCard.tsx')
  assert.match(communityCard, /previewUrl/)
  assert.match(communityCard, /loading='lazy'/)

  console.log('payload portal visibility audit passed')
}

void run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
