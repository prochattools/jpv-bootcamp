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

  for (const unsafeKey of ['signedUrl', 'token', 'secret', 'hostname', 'storagePath'] as const) {
    await assert.rejects(
      registerCommunityFileMetadata(buildPayload(), {
        memberId: 'member_moderator',
        spaceId: 'space_private',
        mediaId: 'media_pdf',
        title: `Rejected ${unsafeKey}`,
        attachmentType: 'document',
        [unsafeKey]: 'must-not-persist',
      } as Parameters<typeof registerCommunityFileMetadata>[1] & Record<typeof unsafeKey, string>),
      /Unsafe attachment metadata is not accepted/
    )
  }

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
  assert.doesNotMatch(source, /\b(?:FormData|multipart|uploadBytes)\b/i)
  assert.doesNotMatch(
    source,
    /\b(?:create|generate|get|sign)[A-Za-z0-9_]*(?:SignedUrl|Signature|Token|Credentials)\s*\(/i
  )
  assert.doesNotMatch(
    source,
    /\b(?:fetch|axios|request)\s*\(|process\.env|Authorization\s*:/i
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




async function testStructuredAttachmentParentInvariants() {
  function createdFileData(payload: FakePayload): Record<string, unknown> {
    const call = payload.calls.find(
      (candidate) =>
        candidate.operation === 'create' && candidate.collection === 'payload_space_files'
    )
    assert.ok(call?.data, 'expected a payload_space_files create call')
    return call.data
  }

  const standalonePayload = buildPayload()
  await registerCommunityFileMetadata(standalonePayload, {
    memberId: 'member_moderator',
    spaceId: 'space_private',
    mediaId: 'media_pdf',
    title: 'Standalone guide',
  })
  const standaloneData = createdFileData(standalonePayload)
  assert.equal('post' in standaloneData, false)
  assert.equal('comment' in standaloneData, false)

  const postPayload = buildPayload({
    payload_space_posts: [
      {
        id: 'post_private',
        space: 'space_private',
        author: 'member_moderator',
        moderationStatus: 'published',
      },
    ],
  })
  await registerCommunityFileMetadata(postPayload, {
    memberId: 'member_moderator',
    spaceId: 'space_private',
    mediaId: 'media_pdf',
    title: 'Post attachment',
    postId: 'post_private',
  })
  const postData = createdFileData(postPayload)
  assert.equal(postData.post, 'post_private')
  assert.equal('comment' in postData, false)

  const commentPayload = buildPayload({
    payload_space_posts: [
      {
        id: 'post_private',
        space: 'space_private',
        author: 'member_moderator',
        moderationStatus: 'published',
      },
    ],
    payload_space_comments: [
      {
        id: 'comment_private',
        post: 'post_private',
        author: 'member_moderator',
        moderationStatus: 'published',
      },
    ],
  })
  await registerCommunityFileMetadata(commentPayload, {
    memberId: 'member_moderator',
    spaceId: 'space_private',
    mediaId: 'media_pdf',
    title: 'Comment attachment',
    commentId: 'comment_private',
  })
  const commentData = createdFileData(commentPayload)
  assert.equal(commentData.comment, 'comment_private')
  assert.equal('post' in commentData, false)

  await assert.rejects(
    registerCommunityFileMetadata(buildPayload(), {
      memberId: 'member_moderator',
      spaceId: 'space_private',
      mediaId: 'media_pdf',
      title: 'Invalid dual parent',
      postId: 'post_private',
      commentId: 'comment_private',
    }),
    /cannot belong to both a post and a comment/
  )

  await assert.rejects(
    registerCommunityFileMetadata(
      buildPayload({
        payload_space_posts: [
          {
            id: 'post_secret',
            space: 'space_secret',
            author: 'member_moderator',
            moderationStatus: 'published',
          },
        ],
      }),
      {
        memberId: 'member_moderator',
        spaceId: 'space_private',
        mediaId: 'media_pdf',
        title: 'Cross-space post attachment',
        postId: 'post_secret',
      }
    ),
    /does not belong to the selected space/
  )

  await assert.rejects(
    registerCommunityFileMetadata(
      buildPayload({
        payload_space_posts: [
          {
            id: 'post_secret',
            space: 'space_secret',
            author: 'member_moderator',
            moderationStatus: 'published',
          },
        ],
        payload_space_comments: [
          {
            id: 'comment_secret',
            post: 'post_secret',
            author: 'member_moderator',
            moderationStatus: 'published',
          },
        ],
      }),
      {
        memberId: 'member_moderator',
        spaceId: 'space_private',
        mediaId: 'media_pdf',
        title: 'Cross-space comment attachment',
        commentId: 'comment_secret',
      }
    ),
    /does not belong to the selected space/
  )

  const uploaderPayload = buildPayload()
  await registerCommunityFileMetadata(uploaderPayload, {
    memberId: 'member_moderator',
    spaceId: 'space_private',
    mediaId: 'media_pdf',
    title: 'Trusted uploader',
    uploadedBy: 'member_outsider',
  } as Parameters<typeof registerCommunityFileMetadata>[1] & { uploadedBy: string })
  assert.equal(createdFileData(uploaderPayload).uploadedBy, 'member_moderator')

  console.log('structured community attachment parent invariant tests passed')
}

void testStructuredAttachmentParentInvariants().catch((error) => {
  console.error(error)
  process.exitCode = 1
})




async function testStructuredAttachmentMediaInvariants() {
  function createdFileData(payload: FakePayload): Record<string, unknown> {
    const call = payload.calls.find(
      (candidate) =>
        candidate.operation === 'create' && candidate.collection === 'payload_space_files'
    )
    assert.ok(call?.data, 'expected a payload_space_files create call')
    return call.data
  }

  const documentPayload = buildPayload()
  await registerCommunityFileMetadata(documentPayload, {
    memberId: 'member_moderator',
    spaceId: 'space_private',
    mediaId: 'media_pdf',
    title: 'Protected document',
    attachmentType: 'document',
  })
  const documentData = createdFileData(documentPayload)
  assert.equal(documentData.attachmentType, 'document')
  assert.equal(documentData.protectedFile, 'media_pdf')

  await assert.rejects(
    registerCommunityFileMetadata(buildPayload(), {
      memberId: 'member_moderator',
      spaceId: 'space_private',
      title: 'Missing protected file',
      attachmentType: 'document',
    }),
    /Protected private media is required/
  )

  const imagePayload = buildPayload()
  await registerCommunityFileMetadata(imagePayload, {
    memberId: 'member_moderator',
    spaceId: 'space_private',
    mediaId: 'media_image',
    title: 'Accessible image',
    attachmentType: 'image',
    altText: 'Instructor pointing to the lesson diagram',
  })
  const imageData = createdFileData(imagePayload)
  assert.equal(imageData.attachmentType, 'image')
  assert.equal(imageData.altText, 'Instructor pointing to the lesson diagram')

  await assert.rejects(
    registerCommunityFileMetadata(buildPayload(), {
      memberId: 'member_moderator',
      spaceId: 'space_private',
      mediaId: 'media_pdf',
      title: 'Wrong image media',
      attachmentType: 'image',
      altText: 'Not really an image',
    }),
    /require image media/
  )

  await assert.rejects(
    registerCommunityFileMetadata(buildPayload(), {
      memberId: 'member_moderator',
      spaceId: 'space_private',
      mediaId: 'media_image',
      title: 'Image without alt text',
      attachmentType: 'image',
    }),
    /Image alt text is required/
  )

  for (const input of [
    {
      title: 'YouTube lesson',
      externalProvider: 'youtube' as const,
      externalMediaId: 'dQw4w9WgXcQ',
    },
    {
      title: 'Vimeo lesson',
      externalProvider: 'vimeo' as const,
      externalMediaId: '123456789',
    },
  ]) {
    const payload = buildPayload()
    await registerCommunityFileMetadata(payload, {
      memberId: 'member_moderator',
      spaceId: 'space_private',
      attachmentType: 'external_video',
      ...input,
    })
    const data = createdFileData(payload)
    assert.equal(data.attachmentType, 'external_video')
    assert.equal(data.externalProvider, input.externalProvider)
    assert.equal(data.externalMediaId, input.externalMediaId)
    assert.equal('protectedFile' in data, false)
  }

  await assert.rejects(
    registerCommunityFileMetadata(buildPayload(), {
      memberId: 'member_moderator',
      spaceId: 'space_private',
      title: 'Unsupported provider',
      attachmentType: 'external_video',
      externalProvider: 'dailymotion',
      externalMediaId: 'valid-looking-id',
    } as unknown as Parameters<typeof registerCommunityFileMetadata>[1]),
    /provider must be YouTube or Vimeo/
  )

  await assert.rejects(
    registerCommunityFileMetadata(buildPayload(), {
      memberId: 'member_moderator',
      spaceId: 'space_private',
      title: 'Unsafe external URL',
      attachmentType: 'external_video',
      externalProvider: 'youtube',
      externalMediaId: 'https://youtube.example/watch?v=abc',
    }),
    /media ID is invalid/
  )

  const privateVideoPayload = buildPayload()
  await registerCommunityFileMetadata(privateVideoPayload, {
    memberId: 'member_moderator',
    spaceId: 'space_private',
    title: 'Private Bunny lesson',
    attachmentType: 'private_video',
    bunnyVideoId: '123e4567-e89b-12d3-a456-426614174000',
    bunnyLibraryId: '987654',
  })
  const privateVideoData = createdFileData(privateVideoPayload)
  assert.equal(privateVideoData.attachmentType, 'private_video')
  assert.equal(privateVideoData.bunnyVideoId, '123e4567-e89b-12d3-a456-426614174000')
  assert.equal(privateVideoData.bunnyLibraryId, '987654')

  await assert.rejects(
    registerCommunityFileMetadata(buildPayload(), {
      memberId: 'member_moderator',
      spaceId: 'space_private',
      title: 'Invalid Bunny video',
      attachmentType: 'private_video',
      bunnyVideoId: 'not-a-uuid',
      bunnyLibraryId: '987654',
    }),
    /Bunny video ID is invalid/
  )

  await assert.rejects(
    registerCommunityFileMetadata(buildPayload(), {
      memberId: 'member_moderator',
      spaceId: 'space_private',
      title: 'Invalid Bunny library',
      attachmentType: 'private_video',
      bunnyVideoId: '123e4567-e89b-12d3-a456-426614174000',
      bunnyLibraryId: 'library-987654',
    }),
    /Bunny library ID is invalid/
  )

  await assert.rejects(
    registerCommunityFileMetadata(buildPayload(), {
      memberId: 'member_moderator',
      spaceId: 'space_private',
      mediaId: 'media_pdf',
      title: 'Incompatible fields',
      attachmentType: 'external_video',
      externalProvider: 'youtube',
      externalMediaId: 'dQw4w9WgXcQ',
    }),
    /incompatible/
  )

  for (const unsafeKey of ['signedUrl', 'token', 'secret', 'hostname', 'storagePath'] as const) {
    await assert.rejects(
      registerCommunityFileMetadata(buildPayload(), {
        memberId: 'member_moderator',
        spaceId: 'space_private',
        mediaId: 'media_pdf',
        title: `Unsafe ${unsafeKey}`,
        attachmentType: 'document',
        [unsafeKey]: 'must-not-persist',
      } as Parameters<typeof registerCommunityFileMetadata>[1] & Record<typeof unsafeKey, string>),
      /Unsafe attachment metadata is not accepted/
    )
  }

  const safePersistencePayload = buildPayload()
  await registerCommunityFileMetadata(safePersistencePayload, {
    memberId: 'member_moderator',
    spaceId: 'space_private',
    mediaId: 'media_pdf',
    title: 'Allowlisted persistence',
    attachmentType: 'document',
  })
  const persistedCreateData = safePersistencePayload.calls
    .filter((candidate) => candidate.operation === 'create')
    .map((candidate) => candidate.data)
  assert.doesNotMatch(
    JSON.stringify(persistedCreateData),
    /signedUrl|token|secret|hostname|storagePath|untrusted\.example/i
  )

  console.log('structured community attachment media invariant tests passed')
}

void testStructuredAttachmentMediaInvariants().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
