import assert from 'node:assert/strict'

import {
  ensureAdministratorMemberIdentity,
  resolveAdministratorMemberIdentity,
} from './adminMemberIdentity'

type Doc = Record<string, any> & { id: string }

const collections: Record<string, Doc[]> = {
  payload_members: [],
  payload_member_profiles: [],
  payload_users: [{ id: 'admin_1', email: ' Westhoek@Hotmail.com ' }],
}
let nextId = 1
let writes = 0
const payload = {
  find: async ({ collection, where }: { collection: string; where?: Record<string, any> }) => ({
    docs: (collections[collection] ?? []).filter((doc) => {
      if (!where) return true
      return Object.entries(where).every(([field, condition]) => String(doc[field]) === String(condition?.equals))
    }),
    hasNextPage: false,
  }),
  findByID: async ({ collection, id }: { collection: string; id: string }) => {
    const doc = (collections[collection] ?? []).find((candidate) => String(candidate.id) === String(id))
    if (!doc) throw new Error('missing')
    return doc
  },
  create: async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
    writes += 1
    const doc = { id: `created_${nextId++}`, ...data } as Doc
    ;(collections[collection] ??= []).push(doc)
    return doc
  },
  update: async ({ collection, id, data }: { collection: string; id: string; data: Record<string, unknown> }) => {
    writes += 1
    const docs = collections[collection] ?? []
    const index = docs.findIndex((candidate) => String(candidate.id) === String(id))
    if (index < 0) throw new Error('missing')
    docs[index] = { ...docs[index], ...data }
    return docs[index]
  },
}

const first = await ensureAdministratorMemberIdentity(payload as never, collections.payload_users[0] as never)
assert.ok(first)
assert.equal(first.member.email, 'westhoek@hotmail.com')
assert.equal(first.member.isAdministrator, true)
assert.equal(first.profile.member, first.member.id)
assert.equal(collections.payload_users[0]?.portalMember, first.member.id)

const second = await ensureAdministratorMemberIdentity(payload as never, {
  ...collections.payload_users[0],
  portalMember: first.member.id,
} as never)
assert.equal(second?.member.id, first.member.id)
assert.equal(collections.payload_members.length, 1)
assert.equal(collections.payload_member_profiles.length, 1)

const writesBeforeResolution = writes
const resolved = await resolveAdministratorMemberIdentity(payload as never, {
  ...collections.payload_users[0],
  portalMember: first.member.id,
} as never)
assert.equal(resolved.source, 'linked')
assert.equal(resolved.member?.id, first.member.id)
assert.equal(writes, writesBeforeResolution)

const staleLinkResolution = await resolveAdministratorMemberIdentity(payload as never, {
  id: 'admin_3',
  email: 'westhoek@hotmail.com',
  portalMember: 'missing_member',
} as never)
assert.equal(staleLinkResolution.source, 'email')
assert.equal(staleLinkResolution.member?.id, first.member.id)
assert.equal(writes, writesBeforeResolution)

collections.payload_members.push({ id: 'duplicate_1', email: 'westhoek@hotmail.com' })
const ambiguous = await resolveAdministratorMemberIdentity(payload as never, {
  id: 'admin_2',
  email: 'westhoek@hotmail.com',
} as never)
assert.equal(ambiguous.source, 'ambiguous')
assert.equal(ambiguous.member, null)
assert.equal(writes, writesBeforeResolution)

console.log('Administrator member identity contract: PASS')
