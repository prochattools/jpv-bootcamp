import type { PayloadCourseAccessAPI, PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import { relationshipId } from '@/lib/domain/relationships'
import { uniqueSlugForName } from '@/lib/domain/slugs'
import { boundedText, validateTitle } from '@/lib/domain/validation'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import { PortalAdminActionError } from '@/lib/portalAdmin/actionResult'

export type MemberGroupInput = {
  name: string
  description?: string
  memberIds?: string[]
  expectedUpdatedAt?: string | null
}

export type MemberGroupSummary = {
  id: string
  name: string
  slug: string
  status: 'active' | 'archived'
  description: string | null
  memberIds: string[]
  memberCount: number
  updatedAt: string | null
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim()
  if (typeof value === 'number') return String(value)
  return null
}

function memberIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(relationshipId).filter((id): id is string => Boolean(id))))
}

function summary(group: PayloadDocument): MemberGroupSummary {
  const ids = memberIds(group.members)
  return {
    id: String(group.id),
    name: stringValue(group.name) ?? 'Member group',
    slug: stringValue(group.slug) ?? '',
    status: group.status === 'archived' ? 'archived' : 'active',
    description: stringValue(group.description),
    memberIds: ids,
    memberCount: ids.length,
    updatedAt: stringValue(group.updatedAt),
  }
}

async function findAll(
  payload: PayloadCourseAccessAPI,
  collection: string,
  where?: Record<string, unknown>,
  limit = 100,
): Promise<PayloadDocument[]> {
  const docs: PayloadDocument[] = []
  let page = 1
  do {
    const result = await payload.find({
      collection,
      where,
      limit,
      page,
      depth: 0,
      overrideAccess: true,
    })
    docs.push(...(result.docs as PayloadDocument[]))
    if (!result.hasNextPage || page >= 1000) break
    page += 1
  } while (true)
  return docs
}

function normalizedMemberIds(input: string[] | undefined): string[] {
  return Array.from(new Set((input ?? []).map((value) => String(value).trim()).filter(Boolean)))
}

async function assertActiveMembers(payload: PayloadCourseWriteAPI, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const result = await payload.find({
    collection: 'payload_members',
    where: {
      and: [
        { id: { in: ids } },
        { accountStatus: { equals: 'active' } },
      ],
    },
    limit: Math.min(ids.length, 500),
    depth: 0,
    overrideAccess: true,
  })
  const found = new Set(result.docs.map((member) => String(member.id)))
  const missing = ids.filter((id) => !found.has(id))
  if (missing.length > 0) {
    throw new PortalAdminActionError('invalid_input', 'Groups can only include active members.')
  }
}

function assertExpectedUpdatedAt(group: PayloadDocument, expectedUpdatedAt?: string | null): void {
  if (expectedUpdatedAt === undefined) return
  const actual = stringValue(group.updatedAt)
  if ((expectedUpdatedAt ?? null) !== actual) {
    throw new PortalAdminActionError('conflict', 'This group changed in another session. Refresh and try again.')
  }
}

export async function listMemberGroups(
  payload: PayloadCourseAccessAPI,
  includeArchived = false,
): Promise<MemberGroupSummary[]> {
  const docs = await findAll(
    payload,
    'payload_member_groups',
    includeArchived ? undefined : { status: { equals: 'active' } },
    200,
  )
  return docs.map(summary).sort((left, right) => left.name.localeCompare(right.name))
}

export async function createMemberGroupCommand(
  payload: PayloadCourseWriteAPI,
  actorId: string,
  input: MemberGroupInput,
): Promise<MemberGroupSummary> {
  const name = validateTitle(input.name)
  const ids = normalizedMemberIds(input.memberIds)
  await assertActiveMembers(payload, ids)
  const slug = await uniqueSlugForName(payload, 'payload_member_groups', name)
  const created = await payload.create({
    collection: 'payload_member_groups',
    data: {
      name,
      slug,
      status: 'active',
      visibility: 'private',
      members: ids,
        description: input.description ? boundedText(input.description, 'Description', 2000) : undefined,
    },
    overrideAccess: true,
  })
  await createAuditEvent(payload, {
    actorType: 'admin',
    actorId,
    action: 'member_group.created',
    targetCollection: 'payload_member_groups',
    targetId: created.id,
    after: { name, slug, memberCount: ids.length },
  })
  return summary(created as PayloadDocument)
}

export async function updateMemberGroupCommand(
  payload: PayloadCourseWriteAPI,
  actorId: string,
  groupId: string,
  input: MemberGroupInput,
): Promise<MemberGroupSummary> {
  const before = await payload.findByID({
    collection: 'payload_member_groups',
    id: groupId,
    depth: 0,
    overrideAccess: true,
  }) as PayloadDocument | null
  if (!before) throw new PortalAdminActionError('not_found', 'Member group not found.')
  assertExpectedUpdatedAt(before, input.expectedUpdatedAt)

  const name = validateTitle(input.name)
  const ids = input.memberIds === undefined ? memberIds(before.members) : normalizedMemberIds(input.memberIds)
  await assertActiveMembers(payload, ids)
  const data: Record<string, unknown> = {
    name,
    members: ids,
    description: input.description ? boundedText(input.description, 'Description', 2000) : undefined,
  }
  const updated = await payload.update({
    collection: 'payload_member_groups',
    id: groupId,
    data,
    overrideAccess: true,
    overrideLock: true,
  })
  await createAuditEvent(payload, {
    actorType: 'admin',
    actorId,
    action: 'member_group.updated',
    targetCollection: 'payload_member_groups',
    targetId: groupId,
    before: { name: before.name, slug: before.slug, memberCount: memberIds(before.members).length },
    after: { name, slug: before.slug, memberCount: ids.length },
  })
  return summary(updated as PayloadDocument)
}

export async function archiveMemberGroupCommand(
  payload: PayloadCourseWriteAPI,
  actorId: string,
  groupId: string,
  expectedUpdatedAt?: string | null,
): Promise<MemberGroupSummary> {
  const before = await payload.findByID({ collection: 'payload_member_groups', id: groupId, depth: 0, overrideAccess: true }) as PayloadDocument | null
  if (!before) throw new PortalAdminActionError('not_found', 'Member group not found.')
  assertExpectedUpdatedAt(before, expectedUpdatedAt)
  const updated = await payload.update({
    collection: 'payload_member_groups',
    id: groupId,
    data: { status: 'archived' },
    overrideAccess: true,
    overrideLock: true,
  })
  await createAuditEvent(payload, {
    actorType: 'admin',
    actorId,
    action: 'member_group.archived',
    targetCollection: 'payload_member_groups',
    targetId: groupId,
    before: { status: before.status },
    after: { status: 'archived' },
  })
  return summary(updated as PayloadDocument)
}

async function groupHasReferences(payload: PayloadCourseWriteAPI, groupId: string): Promise<boolean> {
  const rooms = await findAll(payload, 'live_sessions', undefined, 100)
  if (rooms.some((room) => Array.isArray(room.targetGroupIds) && room.targetGroupIds.some((id) => String(id) === groupId))) return true

  const posts = await findAll(payload, 'payload_posts', undefined, 100)
  return posts.some((post) => {
    const targets = post.targetMemberIds && typeof post.targetMemberIds === 'object' && !Array.isArray(post.targetMemberIds)
      ? (post.targetMemberIds as Record<string, unknown>).groupIds
      : []
    return Array.isArray(targets) && targets.some((id) => String(id) === groupId)
  })
}

export async function deleteMemberGroupCommand(
  payload: PayloadCourseWriteAPI,
  actorId: string,
  groupId: string,
  confirmed: boolean,
): Promise<void> {
  if (!confirmed) throw new PortalAdminActionError('invalid_input', 'Deletion requires explicit confirmation.')
  const group = await payload.findByID({ collection: 'payload_member_groups', id: groupId, depth: 0, overrideAccess: true }) as PayloadDocument | null
  if (!group) throw new PortalAdminActionError('not_found', 'Member group not found.')
  if (await groupHasReferences(payload, groupId)) {
    throw new PortalAdminActionError('dependency_blocked', 'This group is used by Rooms or Updates. Archive it instead.')
  }
  if (!payload.delete) throw new PortalAdminActionError('internal_error', 'Group deletion is unavailable.')
  await payload.delete({ collection: 'payload_member_groups', id: groupId, overrideAccess: true })
  await createAuditEvent(payload, {
    actorType: 'admin',
    actorId,
    action: 'member_group.deleted',
    targetCollection: 'payload_member_groups',
    targetId: groupId,
    before: { name: group.name, slug: group.slug },
  })
}
