import assert from 'node:assert/strict'

import type {
  PayloadCourseWriteAPI,
  PayloadDocument,
  PayloadId,
} from '../src/lib/payloadCourse/accessService'
import { updateMemberProfile } from '../src/lib/members/updateMemberProfile'

type CollectionMap = Record<string, PayloadDocument[]>

function relationValue(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) {
    return String((value as { id: PayloadId }).id)
  }
  return String(value)
}

function matchesWhere(doc: PayloadDocument, where?: Record<string, unknown>): boolean {
  if (!where) return true
  return Object.entries(where).every(([field, condition]) => {
    if (!condition || typeof condition !== 'object') return doc[field] === condition
    const record = condition as Record<string, unknown>
    if ('equals' in record) return relationValue(doc[field]) === String(record.equals)
    return false
  })
}

class FakePayload implements PayloadCourseWriteAPI {
  readonly calls: Array<{
    method: 'find' | 'create' | 'update'
    collection: string
    overrideAccess?: boolean
    id?: PayloadId
    data?: Record<string, unknown>
    where?: Record<string, unknown>
  }> = []
  private nextId = 1

  constructor(private readonly collections: CollectionMap) {}

  async find(args: {
    collection: string
    where?: Record<string, unknown>
    limit?: number
    overrideAccess?: boolean
  }) {
    this.calls.push({
      method: 'find',
      collection: args.collection,
      where: args.where,
      overrideAccess: args.overrideAccess,
    })
    const docs = (this.collections[args.collection] ?? []).filter((doc) => matchesWhere(doc, args.where))
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const doc = (this.collections[args.collection] ?? []).find((item) => String(item.id) === String(args.id))
    if (!doc) throw new Error(`missing ${args.collection}:${args.id}`)
    return doc
  }

  async create(args: {
    collection: string
    data: Record<string, unknown>
    overrideAccess?: boolean
  }) {
    this.calls.push({
      method: 'create',
      collection: args.collection,
      data: args.data,
      overrideAccess: args.overrideAccess,
    })
    const doc = { id: `${args.collection}_${this.nextId++}`, ...args.data }
    this.collections[args.collection] = this.collections[args.collection] ?? []
    this.collections[args.collection].push(doc)
    return doc
  }

  async update(args: {
    collection: string
    id: PayloadId
    data: Record<string, unknown>
    overrideAccess?: boolean
  }) {
    this.calls.push({
      method: 'update',
      collection: args.collection,
      id: args.id,
      data: args.data,
      overrideAccess: args.overrideAccess,
    })
    const docs = this.collections[args.collection] ?? []
    const index = docs.findIndex((doc) => String(doc.id) === String(args.id))
    if (index < 0) throw new Error(`missing ${args.collection}:${args.id}`)
    docs[index] = { ...docs[index], ...args.data }
    return docs[index]
  }

  docs(collection: string) {
    return this.collections[collection] ?? []
  }
}

async function testValidUpdateAndPreservation() {
  const payload = new FakePayload({
    payload_members: [
      { id: 'member_1', email: 'member@example.test', accountStatus: 'active', emailVerifiedAt: '2026-01-01T00:00:00.000Z' },
    ],
    payload_member_profiles: [
      {
        id: 'profile_1',
        member: 'member_1',
        displayName: 'Old Name',
        company: 'Old Company',
        phone: '123',
        timezone: 'UTC',
        avatar: 'media_1',
        marketingConsent: true,
        transactionalEmailConsent: false,
        internalValue: 'preserve-me',
      },
    ],
  })

  const result = await updateMemberProfile(payload, 'member_1', {
    displayName: '  New   Name  ',
    company: '  New   Company ',
    phone: ' +31   20  123 ',
    timezone: ' Europe/Amsterdam ',
    website: ' https://example.test/member ',
    biography: 'First paragraph.\n\nSecond paragraph.',
    socialInstagram: 'instagram.com/member',
    socialTwitter: 'x.com/member',
    socialLinkedin: 'linkedin.com/in/member',
    socialFacebook: 'facebook.com/member',
    socialYoutube: 'youtube.com/@member',
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.profile.displayName, 'New Name')
  assert.equal(result.profile.company, 'New Company')
  assert.equal(result.profile.phone, '+31 20 123')
  assert.equal(result.profile.timezone, 'Europe/Amsterdam')
  assert.equal(result.profile.website, 'https://example.test/member')
  assert.equal(result.profile.biography, 'First paragraph.\n\nSecond paragraph.')
  assert.deepEqual(result.profile.socialLinks, {
    instagram: 'instagram.com/member',
    twitter: 'x.com/member',
    linkedin: 'linkedin.com/in/member',
    facebook: 'facebook.com/member',
    youtube: 'youtube.com/@member',
  })

  const saved = payload.docs('payload_member_profiles')[0]
  assert.equal(saved.website, 'https://example.test/member')
  assert.equal(saved.biography.root.children.length, 2)
  assert.equal(saved.biography.root.children[0].children[0].text, 'First paragraph.')
  assert.deepEqual(saved.socialLinks, {
    instagram: 'instagram.com/member',
    twitter: 'x.com/member',
    linkedin: 'linkedin.com/in/member',
    facebook: 'facebook.com/member',
    youtube: 'youtube.com/@member',
  })
  assert.equal(saved.avatar, 'media_1')
  assert.equal(saved.marketingConsent, true)
  assert.equal(saved.transactionalEmailConsent, false)
  assert.equal(saved.internalValue, 'preserve-me')
  assert.equal(payload.calls.find((call) => call.method === 'update')?.overrideAccess, true)
}

async function testProfileCreation() {
  const payload = new FakePayload({
    payload_members: [
      { id: 'member_create', email: 'create@example.test', accountStatus: 'active', emailVerifiedAt: '2026-01-01T00:00:00.000Z' },
    ],
    payload_member_profiles: [],
  })

  const result = await updateMemberProfile(payload, 'member_create', {
    displayName: 'Created Member',
    company: '',
    phone: '',
    timezone: '',
  })

  assert.equal(result.ok, true)
  const saved = payload.docs('payload_member_profiles')[0]
  assert.equal(saved.member, 'member_create')
  assert.equal(saved.displayName, 'Created Member')
  assert.equal(saved.company, null)
  assert.equal(saved.marketingConsent, false)
  assert.equal(saved.transactionalEmailConsent, true)
  assert.equal(payload.calls.find((call) => call.method === 'create')?.overrideAccess, true)
}

async function testMissingDisplayName() {
  const payload = new FakePayload({ payload_member_profiles: [] })
  const result = await updateMemberProfile(payload, 'member_1', {
    displayName: '   \n\t ',
  })

  assert.deepEqual(result, { ok: false, error: 'display_name_required' })
  assert.equal(payload.calls.length, 0)
}

async function testMaximumLengths() {
  const payload = new FakePayload({
    payload_members: [
      { id: 'member_1', email: 'member@example.test', accountStatus: 'active', emailVerifiedAt: '2026-01-01T00:00:00.000Z' },
    ],
    payload_member_profiles: [],
  })
  const result = await updateMemberProfile(payload, 'member_1', {
    displayName: 'D'.repeat(100),
    company: 'C'.repeat(120),
    phone: 'P'.repeat(60),
    timezone: 'T'.repeat(100),
  })

  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.profile.displayName.length, 80)
  assert.equal(result.profile.company?.length, 100)
  assert.equal(result.profile.phone?.length, 40)
  assert.equal(result.profile.timezone?.length, 80)
}

async function testAuthenticatedMemberOwnership() {
  const payload = new FakePayload({
    payload_members: [
      { id: 'member_a', email: 'a@example.test', accountStatus: 'active', emailVerifiedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'member_b', email: 'b@example.test', accountStatus: 'active', emailVerifiedAt: '2026-01-01T00:00:00.000Z' },
    ],
    payload_member_profiles: [
      { id: 'profile_a', member: 'member_a', displayName: 'Member A' },
      { id: 'profile_b', member: 'member_b', displayName: 'Member B' },
    ],
  })

  const result = await updateMemberProfile(payload, 'member_b', {
    displayName: 'Updated B',
  })

  assert.equal(result.ok, true)
  assert.equal(payload.docs('payload_member_profiles')[0].displayName, 'Member A')
  assert.equal(payload.docs('payload_member_profiles')[1].displayName, 'Updated B')
  const findCall = payload.calls.find((call) => call.method === 'find')
  assert.deepEqual(findCall?.where, { member: { equals: 'member_b' } })
}

async function main() {
  await testValidUpdateAndPreservation()
  await testProfileCreation()
  await testMissingDisplayName()
  await testMaximumLengths()
  await testAuthenticatedMemberOwnership()

  console.log('payload_member_profile_update.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
