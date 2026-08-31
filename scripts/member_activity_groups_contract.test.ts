import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

import { activeMemberRecipients } from '../src/lib/payloadContent/announcements'
import { memberCanAccessContent, memberIdsForContentAudience, parseMemberContentTargets } from '../src/lib/payloadContent/audience'
import { generatePayloadSlugIfMissing, slugFromName, uniqueSlugForName } from '../src/lib/domain/slugs'

type Doc = { id: string; [key: string]: unknown }
const collections: Record<string, Doc[]> = {
  payload_member_groups: [
    { id: 'group-1', status: 'active', members: ['member-1', { id: 'member-2' }] },
    { id: 'group-2', status: 'active', members: ['member-2', 'member-3'] },
    { id: 'group-archived', status: 'archived', members: ['member-3'] },
  ],
  payload_members: [
    { id: 'member-1', accountStatus: 'active', email: 'one@example.test', emailVerifiedAt: '2026-01-01' },
    { id: 'member-2', accountStatus: 'active', email: 'two@example.test', emailVerifiedAt: '2026-01-01' },
    { id: 'member-3', accountStatus: 'blocked', email: 'three@example.test', emailVerifiedAt: '2026-01-01' },
  ],
  payload_member_profiles: [
    { id: 'profile-1', member: 'member-1', displayName: 'One' },
    { id: 'profile-2', member: 'member-2', displayName: 'Two' },
  ],
  payload_posts: [{ id: 'post-1', slug: 'community-update' }],
}

const payload = {
  async find(args: { collection: string; where?: any }) {
    let docs = collections[args.collection] ?? []
    const where = args.where
    const values = where?.and ?? [where]
    for (const condition of values.filter(Boolean)) {
      const [field, operator] = Object.entries(condition)[0] as [string, any]
      if (operator?.equals !== undefined) docs = docs.filter((doc) => String(doc[field]) === String(operator.equals))
      if (operator?.in !== undefined) docs = docs.filter((doc) => operator.in.map(String).includes(String(doc[field])))
    }
    return { docs }
  },
  async findByID(args: { collection: string; id: string }) {
    return (collections[args.collection] ?? []).find((doc) => String(doc.id) === String(args.id)) ?? null
  },
} as any

async function main() {
assert.equal(slugFromName('  Café & Strategy  '), 'cafe-strategy')
assert.equal(slugFromName('Info Forum'), 'info-forum')
assert.throws(() => slugFromName('---'), /at least one letter or number/)

const collisionPayload = {
  async find(args: { where?: any }) {
    const slug = args.where?.and?.[0]?.slug?.equals
    return { docs: slug === 'info-forum' || slug === 'info-forum-2' ? [{ id: slug }] : [] }
  },
}
assert.equal(await uniqueSlugForName(collisionPayload, 'payload_spaces', 'Info Forum'), 'info-forum-3')

const renamed = { title: 'A new title' }
await generatePayloadSlugIfMissing({
  data: renamed,
  originalDoc: { id: 'space-1', slug: 'stable-space' },
  operation: 'update',
  req: { payload: collisionPayload },
  collection: 'payload_spaces',
  sourceField: 'title',
})
assert.equal(renamed.slug, 'stable-space')

assert.deepEqual(parseMemberContentTargets(['member-1', 'member-1']), { memberIds: ['member-1'], groupIds: [] })
assert.deepEqual(parseMemberContentTargets({ memberIds: ['member-1'], groupIds: ['group-1'] }), { memberIds: ['member-1'], groupIds: ['group-1'] })
assert.deepEqual(await memberIdsForContentAudience(payload, 'groups', { memberIds: [], groupIds: ['group-1', 'group-2', 'group-archived'] }), ['member-1', 'member-2', 'member-3'])
assert.equal(await memberCanAccessContent(payload, { id: 'post-1', audience: 'groups', targetMemberIds: { memberIds: [], groupIds: ['group-1'] } }, 'member-2'), true)
assert.equal(await memberCanAccessContent(payload, { id: 'post-1', audience: 'selected', targetMemberIds: { memberIds: [], groupIds: ['group-1'] } }, 'member-2'), true)
assert.equal(await memberCanAccessContent(payload, { id: 'post-1', audience: 'groups', targetMemberIds: { memberIds: [], groupIds: ['group-archived'] } }, 'member-3'), false)
assert.equal(await memberCanAccessContent(payload, { id: 'post-1', audience: 'selected', targetMemberIds: ['member-1'] }, 'member-2'), false)
assert.deepEqual(
  (await activeMemberRecipients(payload, undefined, ['group-1', 'group-2', 'group-archived'])).map((recipient) => recipient.memberId),
  ['member-1', 'member-2'],
)

const root = path.resolve(import.meta.dirname, '..')
const coursePanel = fs.readFileSync(path.join(root, 'src/components/portal/admin/CourseAdminPanel.tsx'), 'utf8')
const createCourse = fs.readFileSync(path.join(root, 'src/components/portal/admin/CreateCourseButton.tsx'), 'utf8')
const spacePanel = fs.readFileSync(path.join(root, 'src/components/portal/admin/SpaceAdminPanel.tsx'), 'utf8')
const roomsPanel = fs.readFileSync(path.join(root, 'src/components/portal/PortalRoomsAdmin.tsx'), 'utf8')
const postsCollection = fs.readFileSync(path.join(root, 'src/collections/PayloadPosts.ts'), 'utf8')
const groupsPanel = fs.readFileSync(path.join(root, 'src/components/portal/MemberGroupsAdmin.tsx'), 'utf8')
const memberActions = fs.readFileSync(path.join(root, 'src/app/(frontend)/portal/members/actions.ts'), 'utf8')
assert.doesNotMatch(coursePanel, /<Field label="Slug"|initialSlug|toSlug/)
assert.doesNotMatch(createCourse, /Slug|slugify|autoSlug/)
assert.doesNotMatch(spacePanel, /id=['"]space-slug|label.*Slug|values\.slug/)
assert.doesNotMatch(roomsPanel, /Slug \(optional\)|name=['"]slug['"]/)
assert.doesNotMatch(postsCollection, /value:\s*['"]groups['"]/)
assert.match(postsCollection, /groupIds/)
assert.doesNotMatch(groupsPanel, /Slug|slug/)
assert.equal(memberActions.split("requirePortalAdmin('/portal/members')").length - 1, 4)

console.log('member_activity_groups_contract.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
