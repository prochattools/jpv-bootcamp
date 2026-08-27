import assert from 'node:assert/strict'

import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import {
  deleteCommunityCommentCommand,
  deleteCommunityPostCommand,
  editCommunityCommentCommand,
  editCommunityPostCommand,
  moderateCommunityCommentCommand,
  moderateCommunityPostCommand,
} from '../src/lib/community/commands'
import { PortalAdminActionError } from '../src/lib/portalAdmin/actionResult'
import { CommunityDomainError } from '../src/lib/community/persistence'
import {
  canEditCommunityPost,
  canModerateCommunityPost,
} from '../src/lib/community/policy'
import type { PortalActor } from '../src/lib/auth/portalActor'

type CollectionMap = Record<string, PayloadDocument[]>

function relationId(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: PayloadId }).id)
  }
  return String(value)
}

function matchesWhere(doc: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) {
    return where.and.every((condition) => matchesWhere(doc, condition as Record<string, unknown>))
  }

  return Object.entries(where).every(([field, condition]) => {
    if (field === 'and') return true
    if (!condition || typeof condition !== 'object') return doc[field] === condition
    const record = condition as Record<string, unknown>
    if ('equals' in record) return relationId(doc[field]) === String(record.equals)
    return true
  })
}

class FakePayload implements PayloadCourseWriteAPI {
  private nextId = 1

  constructor(private readonly collections: CollectionMap) {}

  async find(args: { collection: string; where?: Record<string, unknown>; limit?: number }) {
    const docs = (this.collections[args.collection] ?? []).filter((doc) => matchesWhere(doc, args.where))
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const document = (this.collections[args.collection] ?? []).find((doc) => String(doc.id) === String(args.id))
    if (!document) throw new Error(`missing ${args.collection}:${args.id}`)
    return document
  }

  async create(args: { collection: string; data: Record<string, unknown> }) {
    const document: PayloadDocument = { id: `audit-${this.nextId++}`, ...args.data }
    this.collections[args.collection] ??= []
    this.collections[args.collection].push(document)
    return document
  }

  async update(args: { collection: string; id: PayloadId; data: Record<string, unknown> }) {
    const documents = this.collections[args.collection] ?? []
    const index = documents.findIndex((doc) => String(doc.id) === String(args.id))
    if (index < 0) throw new Error(`missing ${args.collection}:${args.id}`)
    documents[index] = { ...documents[index], ...args.data }
    return documents[index]
  }

  async delete(args: { collection: string; id: PayloadId }) {
    const documents = this.collections[args.collection] ?? []
    const index = documents.findIndex((doc) => String(doc.id) === String(args.id))
    if (index < 0) throw new Error(`missing ${args.collection}:${args.id}`)
    documents.splice(index, 1)
  }

  docs(collection: string) {
    return this.collections[collection] ?? []
  }
}

const access = { overrideAccess: true as const }
const memberOne: PortalActor = { kind: 'member', memberId: 'member-1', email: 'one@example.com' }
const memberTwo: PortalActor = { kind: 'member', memberId: 'member-2', email: 'two@example.com' }
const linkedAdmin: PortalActor = {
  kind: 'admin',
  administratorId: 'admin-1',
  email: 'admin@example.com',
  memberId: 'member-2',
}

function buildPayload() {
  return new FakePayload({
    payload_spaces: [{ id: 'space-1', slug: 'community' }],
    payload_space_posts: [
      { id: 'post-1', space: 'space-1', author: 'member-1', title: 'One', pinned: false, locked: false, moderationStatus: 'visible' },
      { id: 'post-2', space: 'space-1', author: 'member-2', title: 'Two', pinned: false, locked: false, moderationStatus: 'visible' },
      { id: 'post-other-space', space: 'space-2', author: 'member-1', title: 'Other', pinned: false, locked: false, moderationStatus: 'visible' },
    ],
    payload_space_comments: [
      { id: 'comment-1', post: 'post-1', author: 'member-1', displayName: 'One' },
      { id: 'comment-2', post: 'post-2', author: 'member-2', displayName: 'Two' },
    ],
    payload_audit_events: [],
  })
}

async function run() {
  assert.equal(canEditCommunityPost(linkedAdmin, 'member-1'), true, 'linked admins retain admin edit authority')
  assert.equal(canEditCommunityPost(memberOne, 'member-2'), false, 'members cannot edit another member post')
  assert.equal(canModerateCommunityPost(memberOne), false, 'members cannot moderate community posts')

  const payload = buildPayload()

  await editCommunityPostCommand(
    { payload, actor: memberOne, access },
    { postId: 'post-1', expectedSpaceId: 'space-1', title: 'Edited by owner', body: 'Member body' },
  )
  assert.equal(payload.docs('payload_space_posts').find((doc) => doc.id === 'post-1')?.title, 'Edited by owner')

  await assert.rejects(
    editCommunityPostCommand(
      { payload, actor: memberOne, access },
      { postId: 'post-2', expectedSpaceId: 'space-1', title: 'Should fail', body: 'No' },
    ),
    (error: unknown) => error instanceof CommunityDomainError && error.communityCode === 'not_owner',
  )

  await editCommunityCommentCommand(
    { payload, actor: memberOne, access },
    { commentId: 'comment-1', expectedPostId: 'post-1', expectedSpaceId: 'space-1', body: 'Edited comment' },
  )
  await deleteCommunityCommentCommand(
    { payload, actor: memberOne, access },
    { commentId: 'comment-1', expectedPostId: 'post-1', expectedSpaceId: 'space-1' },
  )
  assert.equal(payload.docs('payload_space_comments').some((doc) => doc.id === 'comment-1'), false)

  await assert.rejects(
    deleteCommunityPostCommand(
      { payload, actor: memberOne, access },
      { postId: 'post-2', expectedSpaceId: 'space-1' },
    ),
    (error: unknown) => error instanceof CommunityDomainError && error.communityCode === 'not_owner',
  )

  await moderateCommunityPostCommand(
    { payload, actor: linkedAdmin, access },
    { postId: 'post-1', expectedSpaceId: 'space-1', operation: 'pin' },
  )
  await moderateCommunityPostCommand(
    { payload, actor: linkedAdmin, access },
    { postId: 'post-1', expectedSpaceId: 'space-1', operation: 'lock' },
  )
  await moderateCommunityPostCommand(
    { payload, actor: linkedAdmin, access },
    { postId: 'post-1', expectedSpaceId: 'space-1', operation: 'hide' },
  )
  const moderatedPost = payload.docs('payload_space_posts').find((doc) => doc.id === 'post-1')
  assert.equal(moderatedPost?.pinned, true)
  assert.equal(moderatedPost?.locked, true)
  assert.equal(moderatedPost?.moderationStatus, 'hidden')

  await assert.rejects(
    moderateCommunityPostCommand(
      { payload, actor: memberOne, access },
      { postId: 'post-1', expectedSpaceId: 'space-1', operation: 'unpin' },
    ),
    (error: unknown) => error instanceof PortalAdminActionError && error.code === 'forbidden',
  )

  await assert.rejects(
    moderateCommunityPostCommand(
      { payload, actor: linkedAdmin, access },
      { postId: 'post-other-space', expectedSpaceId: 'space-1', operation: 'unpin' },
    ),
    (error: unknown) => error instanceof CommunityDomainError && error.code === 'invalid_input',
  )

  await assert.rejects(
    deleteCommunityPostCommand(
      { payload, actor: linkedAdmin, access },
      { postId: 'post-2', expectedSpaceId: 'space-1' },
    ),
    (error: unknown) => error instanceof PortalAdminActionError && error.code === 'dependency_blocked',
  )

  await editCommunityPostCommand(
    { payload, actor: linkedAdmin, access },
    { postId: 'post-2', expectedSpaceId: 'space-1', body: { root: { type: 'root', children: [] } } },
  )
  await moderateCommunityCommentCommand(
    { payload, actor: linkedAdmin, access },
    { commentId: 'comment-2', expectedPostId: 'post-2', expectedSpaceId: 'space-1', hidden: true },
  )
  await moderateCommunityCommentCommand(
    { payload, actor: linkedAdmin, access },
    { commentId: 'comment-2', expectedPostId: 'post-2', expectedSpaceId: 'space-1', hidden: false },
  )
  await deleteCommunityCommentCommand(
    { payload, actor: linkedAdmin, access },
    { commentId: 'comment-2', expectedPostId: 'post-2', expectedSpaceId: 'space-1' },
  )
  await deleteCommunityPostCommand(
    { payload, actor: linkedAdmin, access },
    { postId: 'post-2', expectedSpaceId: 'space-1' },
  )

  const audits = payload.docs('payload_audit_events')
  assert.ok(audits.some((event) => event.action === 'post.pinned'))
  assert.ok(audits.some((event) => event.action === 'post.edited'))
  assert.ok(audits.some((event) => event.action === 'comment.hidden'))
  assert.ok(audits.some((event) => event.action === 'comment.deleted'))
  assert.equal(audits.some((event) => event.actorId === 'member-1'), false, 'member edit/delete emits no admin audit')

  console.log('payload_community_domain.test.ts: all assertions passed')
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
