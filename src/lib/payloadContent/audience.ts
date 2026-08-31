import type { PayloadCourseAccessAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import { relationshipId } from '@/lib/domain/relationships'

export type MemberContentAudience = 'all' | 'selected' | 'groups'

export type MemberContentTargetSelection = {
  memberIds: string[]
  groupIds: string[]
}

function ids(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(relationshipId).filter((id): id is string => Boolean(id))))
}

export function parseMemberContentTargets(value: unknown): MemberContentTargetSelection {
  // Older announcements stored selected members directly as a JSON array.
  if (Array.isArray(value)) return { memberIds: ids(value), groupIds: [] }
  if (!value || typeof value !== 'object') return { memberIds: [], groupIds: [] }

  const record = value as Record<string, unknown>
  return {
    memberIds: ids(record.memberIds),
    groupIds: ids(record.groupIds),
  }
}

export async function memberIdsForGroups(
  payload: PayloadCourseAccessAPI,
  groupIds: string[],
  options: { includeArchived?: boolean } = {},
): Promise<string[]> {
  if (groupIds.length === 0) return []

  const status = options.includeArchived
    ? { in: ['active', 'archived'] }
    : { equals: 'active' }
  const result = await payload.find({
    collection: 'payload_member_groups',
    where: {
      and: [
        { id: { in: groupIds } },
        { status },
      ],
    },
    limit: Math.min(groupIds.length, 200),
    depth: 0,
    overrideAccess: true,
  })

  const memberIds = new Set<string>()
  for (const group of result.docs as PayloadDocument[]) {
    for (const member of Array.isArray(group.members) ? group.members : []) {
      const memberId = relationshipId(member)
      if (memberId) memberIds.add(memberId)
    }
  }
  return Array.from(memberIds)
}

export async function memberIdsForContentAudience(
  payload: PayloadCourseAccessAPI,
  audience: MemberContentAudience,
  targets: MemberContentTargetSelection,
): Promise<string[]> {
  if (audience === 'all') {
    const result = await payload.find({
      collection: 'payload_members',
      where: { accountStatus: { equals: 'active' } },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })
    return result.docs.map((member) => String(member.id))
  }

  const groupMemberIds = audience === 'groups' ? await memberIdsForGroups(payload, targets.groupIds) : []
  return Array.from(new Set([...targets.memberIds, ...groupMemberIds]))
}

export async function memberCanAccessContent(
  payload: PayloadCourseAccessAPI,
  document: PayloadDocument,
  memberId: string | null | undefined,
): Promise<boolean> {
  const targets = parseMemberContentTargets(document.targetMemberIds)
  const audience = document.audience === 'groups' || (document.audience === 'selected' && targets.groupIds.length > 0)
    ? 'groups'
    : document.audience === 'selected'
      ? 'selected'
      : 'all'
  if (audience === 'all') return true
  if (!memberId) return false

  if (targets.memberIds.includes(String(memberId))) return true
  if (audience !== 'groups' || targets.groupIds.length === 0) return false
  // Archived groups remain valid historical audiences for published Updates.
  // Active-only filtering is still used when selecting groups for new content.
  return (await memberIdsForGroups(payload, targets.groupIds, { includeArchived: true })).includes(String(memberId))
}
