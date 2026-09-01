import assert from 'node:assert/strict'

import {
  archiveMemberGroupCommand,
  createMemberGroupCommand,
  deleteMemberGroupCommand,
  updateMemberGroupCommand,
} from '../src/lib/portalAdmin/memberGroupCommands'

type Doc = { id: string; [key: string]: unknown }

function relationValue(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id: string }).id)
  return String(value)
}

function matchesWhere(document: Doc, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.and)) return where.and.every((entry) => matchesWhere(document, entry as Record<string, unknown>))
  if (Array.isArray(where.or)) return where.or.some((entry) => matchesWhere(document, entry as Record<string, unknown>))
  return Object.entries(where).every(([field, condition]) => {
    const value = document[field]
    const rule = condition as Record<string, unknown>
    if (rule.equals !== undefined) return Array.isArray(value) ? value.some((item) => relationValue(item) === String(rule.equals)) : relationValue(value) === String(rule.equals)
    if (Array.isArray(rule.in)) return rule.in.map(String).includes(relationValue(value))
    if (rule.not_equals !== undefined) return relationValue(value) !== String(rule.not_equals)
    return true
  })
}

class FakePayload {
  private sequence = 1

  constructor(readonly collections: Record<string, Doc[]>) {}

  async find(args: { collection: string; where?: Record<string, unknown> }) {
    return { docs: (this.collections[args.collection] ?? []).filter((document) => matchesWhere(document, args.where)) }
  }

  async findByID(args: { collection: string; id: string }) {
    return (this.collections[args.collection] ?? []).find((document) => String(document.id) === String(args.id)) ?? null
  }

  async create(args: { collection: string; data: Record<string, unknown> }) {
    const document = { id: args.collection + '-' + this.sequence++, updatedAt: 'created-' + this.sequence, ...args.data }
    this.collections[args.collection] = [...(this.collections[args.collection] ?? []), document]
    return document
  }

  async update(args: { collection: string; id?: string; where?: Record<string, unknown>; data: Record<string, unknown> }) {
    const candidates = args.where
      ? (this.collections[args.collection] ?? []).filter((document) => matchesWhere(document, args.where))
      : [await this.findByID({ collection: args.collection, id: args.id ?? '' })]
    if (args.where) {
      if (candidates.length === 0) return { docs: [], errors: [] }
      const document = candidates[0]
      Object.assign(document, args.data, { updatedAt: 'updated-' + this.sequence++ })
      return { docs: [document], errors: [] }
    }
    const document = candidates[0]
    if (!document) throw new Error('missing update target')
    Object.assign(document, args.data, { updatedAt: 'updated-' + this.sequence++ })
    return document
  }

  async delete(args: { collection: string; id: string }) {
    const documents = this.collections[args.collection] ?? []
    this.collections[args.collection] = documents.filter((document) => String(document.id) !== String(args.id))
  }
}

async function main(): Promise<void> {
  const payload = new FakePayload({
    payload_members: [
      { id: '1', accountStatus: 'active', email: 'one@example.test' },
      { id: '2', accountStatus: 'active', email: 'two@example.test' },
      { id: '3', accountStatus: 'blocked' },
      { id: '4', accountStatus: 'blocked', email: 'admin@example.test' },
    ],
    payload_users: [
      { id: 'admin-user-1', email: 'admin@example.test', displayName: 'Platform Admin', portalMember: '4' },
    ],
    payload_member_profiles: [],
    payload_member_groups: [],
    payload_audit_events: [],
    live_sessions: [],
    payload_posts: [],
  })

  const created = await createMemberGroupCommand(payload as never, 'admin-1', {
    name: 'Café Cohort',
    description: 'Focused members',
    memberIds: ['1', '2'],
  })
  assert.equal(created.slug, 'cafe-cohort')
  assert.equal(created.memberCount, 2)
  assert.deepEqual(payload.collections.payload_member_groups[0]?.members, [1, 2])

  const administratorGroup = await createMemberGroupCommand(payload as never, 'admin-1', {
    name: 'Administrators',
    memberIds: ['4'],
  })
  assert.equal(administratorGroup.memberCount, 1)
  await deleteMemberGroupCommand(payload as never, 'admin-1', administratorGroup.id, true)


  const renamed = await updateMemberGroupCommand(payload as never, 'admin-1', created.id, {
    name: 'Renamed Cohort',
    memberIds: ['2'],
    expectedUpdatedAt: created.updatedAt,
  })
  assert.equal(renamed.slug, 'cafe-cohort')
  assert.deepEqual(renamed.memberIds, ['2'])
  assert.equal(renamed.description, 'Focused members')

  const cleared = await updateMemberGroupCommand(payload as never, 'admin-1', created.id, {
    name: renamed.name,
    description: '',
    expectedUpdatedAt: renamed.updatedAt,
  })
  assert.equal(cleared.description, null)

  await assert.rejects(
    updateMemberGroupCommand(payload as never, 'admin-1', created.id, {
      name: 'Stale edit',
      expectedUpdatedAt: 'not-current',
    }),
    (error: unknown) => (error as { code?: string }).code === 'conflict',
  )
  await assert.rejects(
    updateMemberGroupCommand(payload as never, 'admin-1', created.id, {
      name: 'Invalid member',
      memberIds: ['3'],
    }),
    (error: unknown) => (error as { code?: string }).code === 'invalid_input',
  )

  const archived = await archiveMemberGroupCommand(payload as never, 'admin-1', created.id, cleared.updatedAt)
  assert.equal(archived.status, 'archived')

  payload.collections.live_sessions.push({ id: 'room-1', targetGroupIds: [created.id] })
  await assert.rejects(
    deleteMemberGroupCommand(payload as never, 'admin-1', created.id, true),
    (error: unknown) => (error as { code?: string }).code === 'dependency_blocked',
  )
  payload.collections.live_sessions = []
  await deleteMemberGroupCommand(payload as never, 'admin-1', created.id, true)
  assert.equal(payload.collections.payload_member_groups.length, 0)

  const unused = await createMemberGroupCommand(payload as never, 'admin-1', { name: 'Unused Group' })
  await deleteMemberGroupCommand(payload as never, 'admin-1', unused.id, true)
  await assert.rejects(
    deleteMemberGroupCommand(payload as never, 'admin-1', unused.id, false),
    (error: unknown) => (error as { code?: string }).code === 'invalid_input',
  )

  console.log('member_group_commands.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
