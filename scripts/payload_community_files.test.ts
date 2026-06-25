import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import {
  COMMUNITY_FILE_MAX_BYTES,
  registerCommunityFileMetadata,
} from '../src/lib/payloadCourse/communityFiles'

type CollectionMap = Record<string, PayloadDocument[]>

type PayloadCall = {
  operation: 'find' | 'findByID' | 'create' | 'update'
  collection: string
  where?: Record<string, unknown>
  id?: PayloadId
  data?: Record<string, unknown>
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

class FakePayload implements PayloadCourseWriteAPI {
  private nextId = 100
  readonly calls: PayloadCall[] = []

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

  async create(args: {
    collection: string
    data: Record<string, unknown>
    overrideAccess?: boolean
  }): Promise<PayloadDocument> {
    this.calls.push({
      operation: 'create',
      collection: args.collection,
      data: args.data,
      overrideAccess: args.overrideAccess,
    })

    const document = {
      id: `${args.collection}_${this.nextId++}`,
      createdAt: new Date().toISOString(),
      ...args.data,
    }
    this.collections[args.collection] = this.collections[args.collection] ?? []
    this.collections[args.collection].push(document)
    return document
  }

  async update(args: {
    collection: string
    id: PayloadId
    data: Record<string, unknown>
    overrideAccess?: boolean
  }): Promise<PayloadDocument> {
    this.calls.push({
      operation: 'update',
      collection: args.collection,
      id: args.id,
      data: args.data,
      overrideAccess: args.overrideAccess,
    })

    const documents = this.collections[args.collection] ?? []
    const index = documents.findIndex(
      (document) => String(document.id) === String(args.id)
    )
    if (index < 0) throw new Error(`missing ${args.collection}:${String(args.id)}`)
    documents[index] = { ...documents[index], ...args.data }
    return documents[index]
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
  role: 'member' | 'moderator' | 'admin',
  status: string,
  spaceId = 'space_private'
): PayloadDocument {
  return {
    id,
    displayName: `${memberId}:${spaceId}`,
    member: memberId,
    space: spaceId,
    role,
    status,
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function media(
  id: string,
  filename: unknown,
  mimeType: unknown,
  filesize: unknown,
  extras: Record<string, unknown> = {}
): PayloadDocument {
  return {
    id,
    filename,
    mimeType,
    filesize,
    alt: id,
    ...extras,
  }
}

function buildPayload(overrides: Partial<CollectionMap> = {}): FakePayload {
  const base: CollectionMap = {
    payload_members: [
      member('member_moderator'),
      member('member_admin'),
      member('member_regular'),
      member('member_outsider'),
    ],
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
      membership('membership_moderator', 'member_moderator', 'moderator', 'active'),
      membership('membership_admin', 'member_admin', 'admin', 'active'),
      membership('membership_regular', 'member_regular', 'member', 'active'),
    ],
    payload_private_media: [
      media('media_pdf', 'guide.pdf', 'application/pdf', 2048, {
        url: 'https://untrusted.example/guide.pdf',
        signedUrl: 'https://untrusted.example/signed',
        bunnyHostname: 'untrusted.b-cdn.net',
        bunnyToken: 'secret-token',
      }),
      media('media_image', 'image.png', 'image/png', 4096),
      media('media_traversal', '../unsafe\\nested/report.pdf', 'application/pdf', 1024),
    ],
    payload_media: [
      media('public_only', 'public.pdf', 'application/pdf', 1024, {
        url: '/media/public.pdf',
      }),
    ],
    payload_space_files: [],
    payload_audit_events: [],
  }

  return new FakePayload({ ...base, ...overrides })
}

async function testModeratorAndServerControlledFields(): Promise<void> {
  const payload = buildPayload()
  const result = await registerCommunityFileMetadata(payload, {
    memberId: 'member_moderator',
    spaceId: 'space_private',
    mediaId: 'media_pdf',
    title: '  Moderator guide  ',
    uploadedBy: 'member_outsider',
    memberIdOverride: 'member_outsider',
    role: 'admin',
    status: 'active',
    visibility: 'public',
    moderationStatus: 'visible',
    file: 'public_only',
    url: 'https://evil.example/file',
    signedUrl: 'https://evil.example/signed',
    bunnyHostname: 'evil.b-cdn.net',
    bunnyToken: 'client-token',
    credentials: 'client-secret',
  } as Parameters<typeof registerCommunityFileMetadata>[1] & Record<string, unknown>)

  assert.equal(result.document.title, 'Moderator guide')
  assert.equal(result.document.space, 'space_private')
  assert.equal(result.document.uploadedBy, 'member_moderator')
  assert.equal(result.document.protectedFile, 'media_pdf')
  assert.equal(result.document.file, undefined)
  assert.equal(result.document.moderationStatus, 'pending_review')
  assert.deepEqual(result.document.metadata, {
    filename: 'guide.pdf',
    mimeType: 'application/pdf',
    byteSize: 2048,
    storageReference: 'media_pdf',
    createdByService: 'communityFiles.registerCommunityFileMetadata',
  })

  const metadataText = JSON.stringify(result.document.metadata)
  assert.doesNotMatch(metadataText, /url|signed|bunny|token|credential/i)
  assert.equal(result.auditEvent.action, 'space_file.created')

  const membershipCall = payload.calls.find(
    (call) => call.collection === 'payload_space_memberships'
  )
  assert.deepEqual(membershipCall?.where, {
    and: [
      { member: { equals: 'member_moderator' } },
      { space: { equals: 'space_private' } },
    ],
  })

  const privateMediaCall = payload.calls.find(
    (call) =>
      call.operation === 'findByID' &&
      call.collection === 'payload_private_media' &&
      String(call.id) === 'media_pdf'
  )
  assert.ok(privateMediaCall)

  for (const call of payload.calls) {
    assert.equal(call.overrideAccess, true)
  }
}

async function testAdminAndApprovedImage(): Promise<void> {
  const result = await registerCommunityFileMetadata(buildPayload(), {
    memberId: 'member_admin',
    spaceId: 'space_private',
    mediaId: 'media_image',
    title: 'Admin image',
  })

  assert.equal(result.document.uploadedBy, 'member_admin')
  assert.equal(result.document.protectedFile, 'media_image')
  assert.equal(
    (result.document.metadata as Record<string, unknown>).mimeType,
    'image/png'
  )
}

async function testRoleAndMembershipStatuses(): Promise<void> {
  await assert.rejects(
    () =>
      registerCommunityFileMetadata(buildPayload(), {
        memberId: 'member_regular',
        spaceId: 'space_private',
        mediaId: 'media_pdf',
        title: 'Member file',
      }),
    /Active moderator or admin space membership is required/
  )

  for (const status of ['pending', 'muted', 'blocked', 'removed']) {
    const payload = buildPayload({
      payload_space_memberships: [
        membership(`membership_${status}`, 'member_moderator', 'moderator', status),
      ],
    })
    await assert.rejects(
      () =>
        registerCommunityFileMetadata(payload, {
          memberId: 'member_moderator',
          spaceId: 'space_private',
          mediaId: 'media_pdf',
          title: `${status} file`,
        }),
      /Space access denied|Active moderator or admin space membership is required/
    )
  }

  await assert.rejects(
    () =>
      registerCommunityFileMetadata(
        buildPayload({ payload_space_memberships: [] }),
        {
          memberId: 'member_moderator',
          spaceId: 'space_private',
          mediaId: 'media_pdf',
          title: 'Missing membership',
        }
      ),
    /Space access denied|Active moderator or admin space membership is required/
  )
}

async function testUnauthorizedSpacesAndPublicFallback(): Promise<void> {
  for (const spaceId of ['space_private', 'space_secret']) {
    await assert.rejects(
      () =>
        registerCommunityFileMetadata(buildPayload(), {
          memberId: 'member_outsider',
          spaceId,
          mediaId: 'media_pdf',
          title: 'Unauthorized file',
        }),
      /Space access denied/
    )
  }

  await assert.rejects(
    () =>
      registerCommunityFileMetadata(
        buildPayload({ payload_private_media: [] }),
        {
          memberId: 'member_moderator',
          spaceId: 'space_private',
          mediaId: 'public_only',
          title: 'Public fallback is not protected',
        }
      ),
    /Private media record was not found/
  )
}

async function testFilenameAndSizeValidation(): Promise<void> {
  const traversal = await registerCommunityFileMetadata(buildPayload(), {
    memberId: 'member_moderator',
    spaceId: 'space_private',
    mediaId: 'media_traversal',
    title: 'Safe basename',
  })
  assert.equal(
    (traversal.document.metadata as Record<string, unknown>).filename,
    'report.pdf'
  )

  const invalidCases: Array<{
    name: string
    document: PayloadDocument
    pattern: RegExp
  }> = [
    {
      name: 'unsupported MIME',
      document: media('invalid_mime', 'file.exe', 'application/x-msdownload', 100),
      pattern: /MIME type is not allowed/,
    },
    {
      name: 'missing filename',
      document: media('missing_filename', '', 'application/pdf', 100),
      pattern: /filename is required/,
    },
    {
      name: 'zero size',
      document: media('zero_size', 'file.pdf', 'application/pdf', 0),
      pattern: /byte size is invalid/,
    },
    {
      name: 'negative size',
      document: media('negative_size', 'file.pdf', 'application/pdf', -1),
      pattern: /byte size is invalid/,
    },
    {
      name: 'non-finite size',
      document: media(
        'nonfinite_size',
        'file.pdf',
        'application/pdf',
        Number.POSITIVE_INFINITY
      ),
      pattern: /byte size is invalid/,
    },
    {
      name: 'malformed size',
      document: media('malformed_size', 'file.pdf', 'application/pdf', 'many'),
      pattern: /byte size is invalid/,
    },
    {
      name: 'oversized file',
      document: media(
        'oversized',
        'large.mp4',
        'video/mp4',
        COMMUNITY_FILE_MAX_BYTES + 1
      ),
      pattern: /exceeds the community file size limit/,
    },
  ]

  for (const invalidCase of invalidCases) {
    await assert.rejects(
      () =>
        registerCommunityFileMetadata(
          buildPayload({ payload_private_media: [invalidCase.document] }),
          {
            memberId: 'member_moderator',
            spaceId: 'space_private',
            mediaId: invalidCase.document.id,
            title: invalidCase.name,
          }
        ),
      invalidCase.pattern
    )
  }
}

function testNoUploadOrSigningImplementation(): void {
  const source = fs.readFileSync(
    path.resolve(process.cwd(), 'src/lib/payloadCourse/communityFiles.ts'),
    'utf8'
  )
  assert.doesNotMatch(
    source,
    /FormData|multipart|uploadBytes|bunnyToken|signedUrl|credentials/i
  )
  assert.doesNotMatch(source, /https?:\/\//i)
}

async function main(): Promise<void> {
  await testModeratorAndServerControlledFields()
  await testAdminAndApprovedImage()
  await testRoleAndMembershipStatuses()
  await testUnauthorizedSpacesAndPublicFallback()
  await testFilenameAndSizeValidation()
  testNoUploadOrSigningImplementation()
  console.log('payload community file metadata tests passed')
}

void main()
