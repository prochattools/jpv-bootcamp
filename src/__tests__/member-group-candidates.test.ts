import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@payload-config', () => ({ default: {} }))

import { listMemberGroupCandidates } from '@/lib/payloadCourse/memberDirectory'

type Doc = { id: string; [key: string]: unknown }

function matchesWhere(document: Doc, where?: Record<string, unknown>): boolean {
  if (!where) return true
  if (Array.isArray(where.or)) return where.or.some((condition) => matchesWhere(document, condition as Record<string, unknown>))
  if (Array.isArray(where.and)) return where.and.every((condition) => matchesWhere(document, condition as Record<string, unknown>))
  return Object.entries(where).every(([field, condition]) => {
    const rule = condition as Record<string, unknown>
    if (rule.equals !== undefined) return Array.isArray(document[field])
      ? document[field].some((value) => String(value) === String(rule.equals))
      : String(document[field]) === String(rule.equals)
    if (Array.isArray(rule.in)) return rule.in.map(String).includes(String(document[field]))
    return true
  })
}

describe('member group audience candidates', () => {
  it('includes active members and linked Payload administrators with safe display metadata', async () => {
    const collections: Record<string, Doc[]> = {
      payload_members: [
        { id: 'member-1', accountStatus: 'active', email: 'member@example.test' },
        { id: 'member-2', accountStatus: 'blocked', email: 'admin@example.test' },
        { id: 'member-3', accountStatus: 'blocked', email: 'flagged@example.test', isAdministrator: true },
        { id: 'member-4', accountStatus: 'blocked', email: 'unavailable@example.test' },
      ],
      payload_users: [
        { id: 'admin-1', email: 'admin@example.test', displayName: 'Platform Admin', portalMember: 'member-2' },
      ],
      payload_member_profiles: [
        { id: 'profile-1', member: 'member-1', displayName: 'Member One' },
      ],
    }
    const payload = {
      async find(args: { collection: string; where?: Record<string, unknown> }) {
        return { docs: (collections[args.collection] ?? []).filter((document) => matchesWhere(document, args.where)) }
      },
    }

    const candidates = await listMemberGroupCandidates(payload as never)

    expect(candidates.map((candidate) => candidate.email)).toEqual([
      'flagged@example.test',
      'member@example.test',
      'admin@example.test',
    ])
    expect(candidates.find((candidate) => candidate.email === 'admin@example.test')).toMatchObject({
      displayName: 'Platform Admin',
      isAdministrator: true,
    })
    expect(candidates.find((candidate) => candidate.email === 'flagged@example.test')).toMatchObject({ isAdministrator: true })
    expect(candidates.some((candidate) => candidate.email === 'unavailable@example.test')).toBe(false)
  })
})
