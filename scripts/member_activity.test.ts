import assert from 'node:assert/strict'

import { getMemberActivity } from '../src/lib/payloadCourse/memberActivity'

const paragraph = (text: string) => ({ root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text, format: 0 }] }] } })

const records: Record<string, any[]> = {
  payload_spaces: [
    { id: 'space-public', name: 'Open Forum', slug: 'open-forum', status: 'published', visibility: 'public' },
    { id: 'space-private', name: 'Member Forum', slug: 'member-forum', status: 'published', visibility: 'members' },
    { id: 'space-secret', name: 'Secret Forum', slug: 'secret-forum', status: 'published', visibility: 'secret' },
  ],
  payload_members: [
    { id: 'member-1', displayName: 'Ada Member', accountStatus: 'active', emailVerifiedAt: '2026-01-01' },
    { id: 'member-2', displayName: 'Bea Member', accountStatus: 'active', emailVerifiedAt: '2026-01-01' },
  ],
  payload_member_profiles: [{ id: 'profile-1', member: 'member-1', avatar: { url: 'https://cdn.test/ada.png' } }],
  payload_space_memberships: [{ id: 'membership-1', member: 'member-1', space: 'space-private', status: 'active' }],
  payload_space_posts: [
    { id: 'post-public', space: 'space-public', author: 'member-1', moderationStatus: 'visible', title: 'Open post', body: paragraph('A safe public update.'), createdAt: '2026-08-31T10:00:00.000Z' },
    { id: 'post-private', space: 'space-private', author: 'member-2', moderationStatus: 'visible', title: 'Private post', body: paragraph('A member-only update.'), createdAt: '2026-08-31T09:00:00.000Z' },
    { id: 'post-secret', space: 'space-secret', author: 'member-2', moderationStatus: 'visible', title: 'Secret post', body: paragraph('This must not leak.'), createdAt: '2026-08-31T08:00:00.000Z' },
  ],
  payload_space_comments: [{ id: 'comment-public', post: 'post-public', author: 'member-2', moderationStatus: 'visible', body: paragraph('A public reply.'), createdAt: '2026-08-31T10:30:00.000Z' }],
  payload_engagement_reactions: [{ id: 'reaction-public', member: 'member-2', reactionType: 'helpful', targetKind: 'space_post', targetPost: 'post-public', createdAt: '2026-08-31T10:45:00.000Z' }],
}

function matches(doc: any, where: any): boolean {
  if (!where) return true
  if (where.and) return where.and.every((item: any) => matches(doc, item))
  if (where.or) return where.or.some((item: any) => matches(doc, item))
  return Object.entries(where).every(([field, operator]: [string, any]) => {
    const value = doc[field]
    if (operator?.equals !== undefined) return String(value) === String(operator.equals)
    if (operator?.in !== undefined) return operator.in.map(String).includes(String(value))
    return true
  })
}

const payload = {
  async find(args: { collection: string; where?: any }) {
    return { docs: (records[args.collection] ?? []).filter((doc) => matches(doc, args.where)) }
  },
  async findByID(args: { collection: string; id: string }) {
    return (records[args.collection] ?? []).find((doc) => String(doc.id) === String(args.id)) ?? null
  },
} as any

async function main() {
const activity = await getMemberActivity(payload, { kind: 'member', memberId: 'member-1' }, { page: 1, pageSize: 2 })
assert.equal(activity.items.length, 2)
assert.equal(activity.hasMore, true)
assert.ok(activity.items.every((item) => !item.excerpt?.includes('must not leak')))
assert.ok(activity.items.every((item) => !JSON.stringify(item).includes('@')))
assert.deepEqual(activity.items.map((item) => item.id), ['reaction:reaction-public', 'comment:comment-public'])

const secondPage = await getMemberActivity(payload, { kind: 'member', memberId: 'member-1' }, { page: 2, pageSize: 2 })
assert.deepEqual(secondPage.items.map((item) => item.id), ['post:post-public', 'post:post-private'])
assert.equal(secondPage.items.some((item) => item.context.includes('Secret')), false)

const adminActivity = await getMemberActivity(payload, { kind: 'admin' }, { pageSize: 20 })
assert.equal(adminActivity.items.some((item) => item.id === 'post:post-secret'), true)

console.log('member_activity.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
