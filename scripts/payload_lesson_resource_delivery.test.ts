import assert from 'node:assert/strict'
import path from 'node:path'

import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import {
  buildAttachmentContentDisposition,
  isSafeResourceId,
  resolveSafeStoredFilePath,
  safeMimeType,
  sanitizeDownloadFilename,
} from '../src/lib/payloadCourse/lessonResourceDelivery'
import { resolveMemberLessonResourceDownload } from '../src/lib/payloadCourse/lessonResources'

type CollectionMap = Record<string, PayloadDocument[]>

function relationValue(value: unknown): string {
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

class FakePayload implements PayloadCourseAccessAPI {
  constructor(private readonly collections: CollectionMap) {}

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
    const doc = (this.collections[args.collection] ?? []).find(
      (item) => String(item.id) === String(args.id),
    )
    if (!doc) throw new Error(`missing ${args.collection}:${args.id}`)
    return doc
  }
}

function buildPayload(): FakePayload {
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
    ],
    payload_access_groups: [],
    payload_access_grants: [],
    payload_billing_accounts: [],
    payload_subscriptions: [],
    payload_course_modules: [
      {
        id: 'module_foundations',
        course: 'course_foundations',
        title: 'Start Here',
        sortOrder: 10,
      },
    ],
    payload_lessons: [
      {
        id: 'lesson_foundations_1',
        module: 'module_foundations',
        title: 'Welcome',
        slug: 'welcome',
        sortOrder: 10,
      },
      {
        id: 'lesson_foundations_2',
        module: 'module_foundations',
        title: 'Principles',
        slug: 'principles',
        sortOrder: 20,
      },
      {
        id: 'lesson_foundations_3',
        module: 'module_foundations',
        title: 'Advanced Step',
        slug: 'advanced-step',
        sortOrder: 30,
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
    payload_lesson_resources: [
      {
        id: 'resource_foundations_1',
        lesson: 'lesson_foundations_2',
        protectedFile: 'private_media_resource_1',
        title: 'Workbook',
        description: 'Lesson workbook PDF',
        status: 'published',
        sortOrder: 10,
      },
      {
        id: 'resource_foundations_draft',
        lesson: 'lesson_foundations_2',
        file: 'media_resource_2',
        title: 'Draft worksheet',
        status: 'draft',
        sortOrder: 20,
      },
      {
        id: 'resource_later_lesson',
        lesson: 'lesson_foundations_3',
        file: 'media_resource_3',
        title: 'Advanced worksheet',
        status: 'published',
        sortOrder: 10,
      },
      {
        id: 'resource_public',
        lesson: 'lesson_foundations_2',
        file: 'media_public',
        title: 'Public checklist',
        status: 'published',
        sortOrder: 30,
      },
      {
        id: 'resource_missing_media',
        lesson: 'lesson_foundations_2',
        file: 'missing_media',
        title: 'Missing file',
        status: 'published',
        sortOrder: 40,
      },
      {
        id: 'resource_precedence',
        lesson: 'lesson_foundations_2',
        protectedFile: 'private_media_precedence',
        file: 'media_public',
        title: 'Private wins',
        status: 'published',
        sortOrder: 50,
      },
      {
        id: 'resource_nested_filename',
        lesson: 'lesson_foundations_2',
        protectedFile: 'private_media_nested',
        title: 'Nested name',
        status: 'published',
        sortOrder: 60,
      },
    ],
    payload_media: [
      {
        id: 'media_resource_2',
        filename: 'draft.pdf',
        mimeType: 'application/pdf',
        filesize: 1024,
      },
      {
        id: 'media_resource_3',
        filename: 'advanced.pdf',
        mimeType: 'application/pdf',
        filesize: 4096,
      },
      {
        id: 'media_public',
        filename: 'public-checklist.pdf',
        mimeType: 'application/pdf',
        filesize: 3072,
      },
    ],
    payload_private_media: [
      {
        id: 'private_media_resource_1',
        filename: 'workbook.pdf',
        mimeType: 'application/pdf',
        filesize: 2048,
      },
      {
        id: 'private_media_precedence',
        filename: 'private-version.pdf',
        mimeType: 'application/pdf',
        filesize: 5120,
      },
      {
        id: 'private_media_nested',
        filename: 'nested/folder/normalized.pdf',
        mimeType: 'application/pdf',
        filesize: 100,
      },
    ],
  })
}

async function run() {
  assert.equal(isSafeResourceId('resource-123_ABC'), true)
  assert.equal(isSafeResourceId('resource%2Fsecret'), false)
  assert.equal(isSafeResourceId('resource/secret'), false)
  assert.equal(isSafeResourceId('resource\\secret'), false)
  assert.equal(isSafeResourceId(`resource\0secret`), false)
  assert.equal(isSafeResourceId('.'), false)
  assert.equal(isSafeResourceId('..'), false)
  assert.equal(isSafeResourceId('../secret'), false)
  assert.equal(isSafeResourceId('resource%2e%2e'), false)

  assert.equal(sanitizeDownloadFilename('../folder/report?.pdf'), 'report_.pdf')
  assert.equal(sanitizeDownloadFilename('folder\\report:final.pdf'), 'report_final.pdf')
  assert.equal(sanitizeDownloadFilename('"\r\n'), '_')
  assert.equal(sanitizeDownloadFilename('\u0000\u0001'), 'download')

  assert.equal(
    buildAttachmentContentDisposition('report.pdf'),
    `attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`,
  )
  const utfDisposition = buildAttachmentContentDisposition('résumé 2026.pdf')
  assert.match(utfDisposition, /^attachment; filename="resume 2026\.pdf";/)
  assert.match(utfDisposition, /filename\*=UTF-8''r%C3%A9sum%C3%A9%202026\.pdf$/)

  const publicRoot = path.resolve('/tmp/jpv-public-media')
  const privateRoot = path.resolve('/tmp/jpv-private-media')
  assert.equal(resolveSafeStoredFilePath(publicRoot, 'workbook.pdf'), path.join(publicRoot, 'workbook.pdf'))
  assert.equal(resolveSafeStoredFilePath(privateRoot, 'vip-guide.pdf'), path.join(privateRoot, 'vip-guide.pdf'))
  assert.equal(resolveSafeStoredFilePath(publicRoot, '../secret.pdf'), null)
  assert.equal(resolveSafeStoredFilePath(publicRoot, 'folder/secret.pdf'), null)
  assert.equal(resolveSafeStoredFilePath(privateRoot, 'folder\\secret.pdf'), null)
  assert.equal(resolveSafeStoredFilePath(privateRoot, 'report?.pdf'), null)

  assert.equal(safeMimeType('application/pdf'), 'application/pdf')
  assert.equal(safeMimeType('IMAGE/PNG'), 'image/png')
  assert.equal(safeMimeType(null), 'application/octet-stream')
  assert.equal(safeMimeType('text/html; charset=utf-8'), 'application/octet-stream')
  assert.equal(safeMimeType('not-a-mime'), 'application/octet-stream')

  const payload = buildPayload()

  const privateDownload = await resolveMemberLessonResourceDownload(
    payload,
    'member_active',
    'resource_foundations_1',
  )
  assert.equal(privateDownload.allowed, true)
  if (privateDownload.allowed) {
    assert.equal(privateDownload.media.storage, 'private')
    assert.equal(privateDownload.media.filename, 'workbook.pdf')
    assert.equal(privateDownload.downloadUrl, '/learn/resources/resource_foundations_1')
  }

  const missing = await resolveMemberLessonResourceDownload(payload, 'member_active', 'missing_resource')
  assert.deepEqual(missing, { allowed: false, reason: 'resource_not_found' })

  const draft = await resolveMemberLessonResourceDownload(
    payload,
    'member_active',
    'resource_foundations_draft',
  )
  assert.deepEqual(draft, { allowed: false, reason: 'resource_not_published' })

  const missingMedia = await resolveMemberLessonResourceDownload(
    payload,
    'member_active',
    'resource_missing_media',
  )
  assert.deepEqual(missingMedia, { allowed: false, reason: 'file_not_found' })

  const denied = await resolveMemberLessonResourceDownload(
    payload,
    'member_active',
    'resource_later_lesson',
  )
  assert.equal(denied.allowed, false)
  if (!denied.allowed) assert.equal(denied.reason, 'access_denied')

  const publicDownload = await resolveMemberLessonResourceDownload(
    payload,
    'member_active',
    'resource_public',
  )
  assert.equal(publicDownload.allowed, true)
  if (publicDownload.allowed) {
    assert.equal(publicDownload.media.storage, 'public')
    assert.equal(publicDownload.media.filename, 'public-checklist.pdf')
  }

  const precedence = await resolveMemberLessonResourceDownload(
    payload,
    'member_active',
    'resource_precedence',
  )
  assert.equal(precedence.allowed, true)
  if (precedence.allowed) {
    assert.equal(precedence.media.storage, 'private')
    assert.equal(precedence.media.filename, 'private-version.pdf')
  }

  const normalized = await resolveMemberLessonResourceDownload(
    payload,
    'member_active',
    'resource_nested_filename',
  )
  assert.equal(normalized.allowed, true)
  if (normalized.allowed) {
    assert.equal(normalized.media.filename, 'normalized.pdf')
    assert.equal(normalized.fileName, 'normalized.pdf')
  }

  console.log('payload_lesson_resource_delivery.test.ts passed')
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
