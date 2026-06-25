import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import type {
  PayloadCourseAccessAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import {
  getMemberCommunityFiles,
  resolveMemberCommunityFileDownload,
} from '../src/lib/payloadCourse/communityFileDelivery'

type CollectionMap = Record<string, PayloadDocument[]>

type PayloadReadCall = {
  operation: 'find' | 'findByID'
  collection: string
  where?: Record<string, unknown>
  id?: PayloadId
  overrideAccess?: boolean
}

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
    if (Array.isArray(value)) {
      return value.some((item) => relationValue(item) === expected)
    }
    return relationValue(value) === expected
  }

  if ('contains' in record && Array.isArray(value)) {
    return value.some((item) => relationValue(item) === String(record.contains))
  }

  return false
}

function matchesWhere(
  document: PayloadDocument,
  where?: Record<string, unknown>
): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((condition) =>
      matchesWhere(document, condition as Record<string, unknown>)
    )
  }
  if (Array.isArray(where.or)) {
    return where.or.some((condition) =>
      matchesWhere(document, condition as Record<string, unknown>)
    )
  }

  return Object.entries(where).every(([field, condition]) => {
    if (field === 'and' || field === 'or') return true
    return matchesCondition(document[field], condition)
  })
}

class FakePayload implements PayloadCourseAccessAPI {
  readonly calls: PayloadReadCall[] = []

  constructor(private readonly collections: CollectionMap) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    sort?: string
    overrideAccess?: boolean
  }) {
    this.calls.push({
      operation: 'find',
      collection: args.collection,
      where: args.where,
      overrideAccess: args.overrideAccess,
    })

    let documents = [...(this.collections[args.collection] ?? [])].filter((document) =>
      matchesWhere(document, args.where)
    )
    if (args.sort) {
      const direction = args.sort.startsWith('-') ? -1 : 1
      const field = args.sort.replace(/^-/, '')
      documents = documents.sort(
        (a, b) =>
          String(a[field] ?? '').localeCompare(String(b[field] ?? '')) * direction
      )
    }

    return { docs: documents.slice(0, args.limit ?? documents.length) }
  }

  async findByID(args: {
    collection: string
    id: PayloadId
    overrideAccess?: boolean
  }): Promise<PayloadDocument> {
    this.calls.push({
      operation: 'findByID',
      collection: args.collection,
      id: args.id,
      overrideAccess: args.overrideAccess,
    })

    const document = (this.collections[args.collection] ?? []).find(
      (candidate) => String(candidate.id) === String(args.id)
    )
    if (!document) throw new Error(`missing ${args.collection}:${String(args.id)}`)
    return document
  }
}

function member(id: string): PayloadDocument {
  return {
    id,
    email: `${id}@example.com`,
    accountStatus: 'active',
    emailVerifiedAt: '2026-01-01T00:00:00.000Z',
  }
}

function membership(
  id: string,
  memberId: string,
  spaceId: string
): PayloadDocument {
  return {
    id,
    displayName: `${memberId}:${spaceId}`,
    member: memberId,
    space: spaceId,
    role: 'member',
    status: 'active',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function buildPayload(): FakePayload {
  return new FakePayload({
    payload_members: [member('member_authorized'), member('member_outsider')],
    payload_spaces: [
      {
        id: 'space_private',
        name: 'Private Space',
        slug: 'private-space',
        status: 'published',
        visibility: 'private',
      },
      {
        id: 'space_secret',
        name: 'Secret Space',
        slug: 'secret-space',
        status: 'published',
        visibility: 'secret',
      },
    ],
    payload_access_policies: [
      {
        id: 'policy_private',
        resourceType: 'space',
        resourceId: 'space_private',
        status: 'active',
        privacy: 'private',
        requireActiveBilling: false,
        priority: 10,
      },
      {
        id: 'policy_secret',
        resourceType: 'space',
        resourceId: 'space_secret',
        status: 'active',
        privacy: 'secret',
        requireActiveBilling: false,
        priority: 10,
      },
    ],
    payload_access_groups: [],
    payload_access_grants: [],
    payload_billing_accounts: [],
    payload_subscriptions: [],
    payload_space_memberships: [
      membership('membership_private', 'member_authorized', 'space_private'),
      membership('membership_secret', 'member_authorized', 'space_secret'),
    ],
    payload_space_files: [
      {
        id: 'file_private_visible',
        title: 'Private guide',
        space: 'space_private',
        uploadedBy: 'member_authorized',
        protectedFile: 'private_pdf',
        moderationStatus: 'visible',
        createdAt: '2026-01-05T00:00:00.000Z',
      },
      {
        id: 'file_secret_visible',
        title: 'Secret image',
        space: 'space_secret',
        uploadedBy: 'member_authorized',
        protectedFile: 'private_image',
        moderationStatus: 'visible',
        createdAt: '2026-01-04T00:00:00.000Z',
      },
      {
        id: 'file_pending',
        title: 'Pending file',
        space: 'space_private',
        protectedFile: 'private_pdf',
        moderationStatus: 'pending_review',
      },
      {
        id: 'file_hidden',
        title: 'Hidden file',
        space: 'space_private',
        protectedFile: 'private_pdf',
        moderationStatus: 'hidden',
      },
      {
        id: 'file_deleted',
        title: 'Deleted file',
        space: 'space_private',
        protectedFile: 'private_pdf',
        moderationStatus: 'deleted',
      },
      {
        id: 'file_public_fallback',
        title: 'Public fallback',
        space: 'space_private',
        file: 'public_media',
        moderationStatus: 'visible',
      },
      {
        id: 'file_traversal',
        title: 'Unsafe file',
        space: 'space_private',
        protectedFile: 'private_traversal',
        moderationStatus: 'visible',
      },
    ],
    payload_private_media: [
      {
        id: 'private_pdf',
        filename: 'guide.pdf',
        mimeType: 'application/pdf',
        filesize: 2048,
        url: 'https://untrusted.example/guide.pdf',
        signedUrl: 'https://untrusted.example/signed',
        storagePath: '/private/guide.pdf',
        bunnyHostname: 'private.b-cdn.net',
        bunnyToken: 'secret-token',
        credentials: 'secret-credentials',
      },
      {
        id: 'private_image',
        filename: 'image.png',
        mimeType: 'image/png',
        filesize: 4096,
      },
      {
        id: 'private_traversal',
        filename: '../unsafe.pdf',
        mimeType: 'application/pdf',
        filesize: 1024,
      },
    ],
    payload_media: [
      {
        id: 'public_media',
        filename: 'public.pdf',
        mimeType: 'application/pdf',
        filesize: 1024,
        url: '/media/public.pdf',
      },
    ],
  })
}

async function testAuthorizedListingAndResolution(): Promise<void> {
  const payload = buildPayload()
  const files = await getMemberCommunityFiles(payload, 'member_authorized')

  assert.deepEqual(
    files.map((file) => file.id),
    ['file_private_visible', 'file_secret_visible']
  )
  assert.equal(files[0]?.downloadUrl, '/learn/community/files/file_private_visible')
  assert.equal(files[0]?.filename, 'guide.pdf')
  assert.equal(files[0]?.spaceName, 'Private Space')

  const resolution = await resolveMemberCommunityFileDownload(
    payload,
    'member_authorized',
    'file_private_visible'
  )
  assert.equal(resolution.allowed, true)
  if (!resolution.allowed) throw new Error('Expected an allowed file resolution.')
  assert.equal(resolution.media.id, 'private_pdf')
  assert.equal(resolution.media.storage, 'private')

  const privateMediaCall = payload.calls.find(
    (call) =>
      call.operation === 'findByID' &&
      call.collection === 'payload_private_media' &&
      String(call.id) === 'private_pdf'
  )
  assert.ok(privateMediaCall)
  assert.equal(privateMediaCall.overrideAccess, true)

  const serialized = JSON.stringify({ files, resolution })
  assert.doesNotMatch(
    serialized,
    /https?:|signedUrl|storagePath|bunny|token|credential|uploadedBy|memberId|visibility|role/i
  )
}

async function testUnauthorizedAndModerationBoundaries(): Promise<void> {
  const outsiderPayload = buildPayload()
  const outsiderFiles = await getMemberCommunityFiles(
    outsiderPayload,
    'member_outsider'
  )
  assert.deepEqual(outsiderFiles, [])

  for (const fileId of ['file_private_visible', 'file_secret_visible']) {
    const denied = await resolveMemberCommunityFileDownload(
      outsiderPayload,
      'member_outsider',
      fileId
    )
    assert.deepEqual(denied, { allowed: false, reason: 'not_found' })
  }

  for (const fileId of ['file_pending', 'file_hidden', 'file_deleted']) {
    const denied = await resolveMemberCommunityFileDownload(
      buildPayload(),
      'member_authorized',
      fileId
    )
    assert.deepEqual(denied, { allowed: false, reason: 'not_found' })
  }

  const authorizedCalls = JSON.stringify(buildPayload().calls)
  assert.doesNotMatch(authorizedCalls, /member_outsider/)
}

async function testTrustedIdentityAndPrivateMediaOnly(): Promise<void> {
  const authorizedPayload = buildPayload()
  await getMemberCommunityFiles(authorizedPayload, 'member_authorized')
  const authorizedReadLog = JSON.stringify(authorizedPayload.calls)
  assert.match(authorizedReadLog, /member_authorized/)
  assert.doesNotMatch(authorizedReadLog, /member_outsider/)

  const outsiderPayload = buildPayload()
  await getMemberCommunityFiles(outsiderPayload, 'member_outsider')
  const outsiderReadLog = JSON.stringify(outsiderPayload.calls)
  assert.match(outsiderReadLog, /member_outsider/)

  const publicFallback = await resolveMemberCommunityFileDownload(
    buildPayload(),
    'member_authorized',
    'file_public_fallback'
  )
  assert.deepEqual(publicFallback, { allowed: false, reason: 'not_found' })
}

async function testUnsafeIdentifiersAndFilenames(): Promise<void> {
  for (const unsafeId of ['../file', 'file/child', 'file\\child', '%2e%2e']) {
    const denied = await resolveMemberCommunityFileDownload(
      buildPayload(),
      'member_authorized',
      unsafeId
    )
    assert.deepEqual(denied, { allowed: false, reason: 'not_found' })
  }

  const traversal = await resolveMemberCommunityFileDownload(
    buildPayload(),
    'member_authorized',
    'file_traversal'
  )
  assert.deepEqual(traversal, { allowed: false, reason: 'not_found' })
}

function testRouteAndPageSources(): void {
  const routeSource = fs.readFileSync(
    path.resolve(
      process.cwd(),
      'src/app/(frontend)/learn/community/files/[fileId]/route.ts'
    ),
    'utf8'
  )
  assert.match(routeSource, /private\/payload-course-media/)
  assert.match(routeSource, /Cache-Control': 'private, no-store'/)
  assert.match(routeSource, /buildAttachmentContentDisposition/)
  assert.match(routeSource, /safeMimeType/)
  assert.match(routeSource, /X-Content-Type-Options': 'nosniff'/)
  assert.match(routeSource, /notFoundResponse/)
  assert.doesNotMatch(routeSource, /status:\s*401|status:\s*403|Forbidden|Unauthorized/)

  const pageSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/app/(frontend)/learn/community/page.tsx'),
    'utf8'
  )
  assert.match(pageSource, /href=\{file\.downloadUrl\}/)
  assert.doesNotMatch(pageSource, /\/media\/|payload_private_media|bunnyToken|signedUrl/)

  const serviceSource = fs.readFileSync(
    path.resolve(process.cwd(), 'src/lib/payloadCourse/communityFiles.ts'),
    'utf8'
  )
  assert.doesNotMatch(
    serviceSource,
    /FormData|multipart|uploadBytes|bunnyToken|signedUrl|credentials/i
  )
}

async function main(): Promise<void> {
  await testAuthorizedListingAndResolution()
  await testUnauthorizedAndModerationBoundaries()
  await testTrustedIdentityAndPrivateMediaOnly()
  await testUnsafeIdentifiersAndFilenames()
  testRouteAndPageSources()
  console.log('payload community file delivery tests passed')
}

void main()
