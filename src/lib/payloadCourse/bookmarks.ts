import type { PayloadCourseAccessAPI, PayloadCourseWriteAPI, PayloadId } from '@/lib/payloadCourse/accessService'
import { getPayloadMigrationSchemaSqlPrefix } from '@/lib/payloadMigrationSchema'

type BookmarkRow = Record<string, unknown>

function numericId(value: unknown): number | null {
  const normalized = typeof value === 'number'
    ? String(value)
    : typeof value === 'string'
      ? value.trim()
      : ''
  if (!/^\d+$/.test(normalized)) return null
  const parsed = Number(normalized)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function poolFor(payload: PayloadCourseAccessAPI) {
  return payload.db?.pool ?? null
}

/**
 * Bookmarks remain in the legacy space-reactions table so existing imported
 * bookmarks are preserved. Payload's relationship validation currently rejects
 * the actorMember/targetPost pair in production, so use the same validated
 * integer relationships directly when the database pool is available.
 */
async function findBookmarkRowsWithPool(
  payload: PayloadCourseAccessAPI,
  memberId: string,
  postId: string,
): Promise<BookmarkRow[] | undefined> {
  const pool = poolFor(payload)
  const member = numericId(memberId)
  const post = numericId(postId)
  if (!pool || member === null || post === null) return undefined

  const schema = getPayloadMigrationSchemaSqlPrefix()
  try {
    const result = await pool.query({
      text: `SELECT "id", "actor_member_id", "reaction_type", "target_kind", "target_post_id" FROM ${schema}."payload_space_reactions" WHERE "actor_member_id" = $1 AND "reaction_type" = 'bookmark' AND "target_kind" = 'post' AND "target_post_id" = $2 ORDER BY "id" ASC LIMIT 1`,
      values: [member, post],
      statement_timeout: 3000,
    })
    return result.rows
  } catch (error) {
    console.error('JPV_BOOKMARK_SQL_READ_UNAVAILABLE', {
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}

async function deleteBookmarkWithPool(
  payload: PayloadCourseAccessAPI,
  memberId: string,
  postId: string,
  rowId: unknown,
): Promise<boolean | undefined> {
  const pool = poolFor(payload)
  const member = numericId(memberId)
  const post = numericId(postId)
  const id = numericId(rowId)
  if (!pool || member === null || post === null || id === null) return undefined

  const schema = getPayloadMigrationSchemaSqlPrefix()
  try {
    const result = await pool.query({
      text: `DELETE FROM ${schema}."payload_space_reactions" WHERE "id" = $1 AND "actor_member_id" = $2 AND "reaction_type" = 'bookmark' AND "target_kind" = 'post' AND "target_post_id" = $3 RETURNING "id"`,
      values: [id, member, post],
      statement_timeout: 3000,
    })
    return result.rows.length > 0
  } catch (error) {
    console.error('JPV_BOOKMARK_SQL_DELETE_UNAVAILABLE', {
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}

async function createBookmarkWithPool(
  payload: PayloadCourseAccessAPI,
  memberId: string,
  postId: string,
): Promise<boolean | undefined> {
  const pool = poolFor(payload)
  const member = numericId(memberId)
  const post = numericId(postId)
  if (!pool || member === null || post === null) return undefined

  const schema = getPayloadMigrationSchemaSqlPrefix()
  try {
    const result = await pool.query({
      text: `INSERT INTO ${schema}."payload_space_reactions" ("actor_member_id", "reaction_type", "target_kind", "target_post_id", "metadata") VALUES ($1, 'bookmark', 'post', $2, $3::jsonb) ON CONFLICT DO NOTHING RETURNING "id"`,
      values: [member, post, JSON.stringify({ source: 'member_portal' })],
      statement_timeout: 3000,
    })
    return result.rows.length > 0
  } catch (error) {
    console.error('JPV_BOOKMARK_SQL_CREATE_UNAVAILABLE', {
      error: error instanceof Error ? error.message : String(error),
    })
    return undefined
  }
}

async function toggleWithPayload(
  payload: PayloadCourseWriteAPI,
  memberId: string,
  postId: string,
): Promise<boolean> {
  const existing = await payload.find({
    collection: 'payload_space_reactions',
    where: {
      and: [
        { actorMember: { equals: memberId } },
        { reactionType: { equals: 'bookmark' } },
        { targetKind: { equals: 'post' } },
        { targetPost: { equals: postId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const row = existing.docs[0]
  if (row && payload.delete) {
    await payload.delete({ collection: 'payload_space_reactions', id: row.id, overrideAccess: true })
    return false
  }
  if (row) return true

  await payload.create({
    collection: 'payload_space_reactions',
    data: {
      actorMember: memberId,
      reactionType: 'bookmark',
      targetKind: 'post',
      targetPost: postId,
      metadata: { source: 'member_portal' },
    },
    overrideAccess: true,
  })
  return true
}

export async function getMemberBookmarkState(
  payload: PayloadCourseAccessAPI,
  memberId: string,
  postId: string,
): Promise<boolean> {
  const sqlRows = await findBookmarkRowsWithPool(payload, memberId, postId)
  if (sqlRows) return sqlRows.length > 0

  const result = await payload.find({
    collection: 'payload_space_reactions',
    where: {
      and: [
        { actorMember: { equals: memberId } },
        { reactionType: { equals: 'bookmark' } },
        { targetKind: { equals: 'post' } },
        { targetPost: { equals: postId } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs.length > 0
}

export async function toggleMemberBookmark(
  payload: PayloadCourseWriteAPI,
  memberId: PayloadId,
  postId: PayloadId,
): Promise<boolean> {
  const resolvedMemberId = String(memberId)
  const resolvedPostId = String(postId)
  const sqlRows = await findBookmarkRowsWithPool(payload, resolvedMemberId, resolvedPostId)
  if (sqlRows) {
    const row = sqlRows[0]
    if (row) {
      const deleted = await deleteBookmarkWithPool(payload, resolvedMemberId, resolvedPostId, row.id)
      if (deleted !== undefined) return false
    } else {
      const created = await createBookmarkWithPool(payload, resolvedMemberId, resolvedPostId)
      if (created !== undefined) {
        if (created) return true
        const afterRace = await findBookmarkRowsWithPool(payload, resolvedMemberId, resolvedPostId)
        if (afterRace) return afterRace.length > 0
      }
    }
  }

  return toggleWithPayload(payload, resolvedMemberId, resolvedPostId)
}
