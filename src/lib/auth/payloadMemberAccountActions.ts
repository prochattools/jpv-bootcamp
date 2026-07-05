import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import { quotePgIdentifier } from '@/lib/payloadMigrationSchema'

import {
  createMemberAccountActionService,
  type MemberAccountActionPurpose,
  type MemberAccountActionRecord,
  type MemberAccountActionRepository,
  type MemberAccountActionServiceOptions,
  type MemberAccountActionTransport,
} from './memberAccountActions'
import {
  buildConsumeMemberAccountActionSql,
  buildReplaceActiveMemberAccountActionSql,
} from './memberAccountActionSql'
import { getMemberEmailVerificationSchema } from './memberEmailVerificationSql'

const actionCollection = 'payload_member_verification_tokens'
const emailEventCollection = 'payload_email_events'

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return null
}

function toIso(value: unknown): string | undefined {
  const raw = asString(value)
  if (!raw) return undefined
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function isPurpose(value: unknown): value is MemberAccountActionPurpose {
  return (
    value === 'member_invitation' ||
    value === 'set_password' ||
    value === 'password_reset' ||
    value === 'email_change_confirmation'
  )
}

function toMemberId(value: string): number {
  const memberId = Number(value)
  if (!Number.isSafeInteger(memberId) || memberId <= 0) {
    throw new Error('Member account actions require a positive integer member ID')
  }
  return memberId
}

function actionRecordFromDocument(document: PayloadDocument): MemberAccountActionRecord | null {
  const memberId = asString(document.member)
  const email = asString(document.email)
  const purpose = document.purpose
  const tokenDigest = asString(document.tokenDigest)
  const expiresAt = toIso(document.expiresAt)
  const createdAt = toIso(document.createdAt)
  const idempotencyKey = asString(document.idempotencyKey)
  if (
    !memberId ||
    !email ||
    !isPurpose(purpose) ||
    !tokenDigest ||
    !expiresAt ||
    !createdAt ||
    !idempotencyKey
  ) {
    return null
  }

  return {
    memberId,
    email,
    purpose,
    tokenDigest,
    expiresAt,
    createdAt,
    consumedAt: toIso(document.consumedAt),
    invalidatedAt: toIso(document.invalidatedAt),
    lastSentAt: toIso(document.lastSentAt),
    sendAttempts: Number(document.sendAttempts ?? 0),
    idempotencyKey,
  }
}

export type AtomicMemberAccountActionStore = {
  replaceActive(record: MemberAccountActionRecord): Promise<void>
  consume(
    tokenDigest: string,
    purpose: MemberAccountActionPurpose,
    consumedAt: string,
  ): Promise<string | null>
}

type QueryResult = {
  rows?: Array<Record<string, unknown>>
}

type QueryClient = {
  query(sql: string, values?: readonly unknown[]): Promise<QueryResult>
}

function resolveQueryClient(payload: PayloadCourseWriteAPI): QueryClient {
  const database = asRecord((payload as unknown as { db?: unknown }).db)
  const directPool = database.pool
  if (directPool && typeof directPool === 'object' && 'query' in directPool) {
    return directPool as QueryClient
  }

  const drizzle = asRecord(database.drizzle)
  const session = asRecord(drizzle.session)
  const sessionClient = session.client
  if (sessionClient && typeof sessionClient === 'object' && 'query' in sessionClient) {
    return sessionClient as QueryClient
  }

  throw new Error('Payload PostgreSQL query client is unavailable')
}

export function createPostgresAtomicMemberAccountActionStore(
  payload: PayloadCourseWriteAPI,
  databaseUrl = process.env.DATABASE_URL,
): AtomicMemberAccountActionStore {
  const client = resolveQueryClient(payload)
  const schemaName = getMemberEmailVerificationSchema(databaseUrl)
  const replaceSql = buildReplaceActiveMemberAccountActionSql(schemaName)
  const consumeSql = buildConsumeMemberAccountActionSql(schemaName)

  return {
    async replaceActive(record) {
      await client.query(replaceSql, [
        toMemberId(record.memberId),
        record.email,
        record.purpose,
        record.tokenDigest,
        record.expiresAt,
        record.lastSentAt ?? null,
        record.sendAttempts,
        record.createdAt,
        record.idempotencyKey,
      ])
    },

    async consume(tokenDigest, purpose, consumedAt) {
      const result = await client.query(consumeSql, [tokenDigest, purpose, consumedAt])
      return asString(result.rows?.[0]?.member_id)
    },
  }
}

export function createPayloadMemberAccountActionRepository(
  payload: PayloadCourseWriteAPI,
  atomicStore: AtomicMemberAccountActionStore,
): MemberAccountActionRepository {
  return {
    async findActiveAction(memberId, purpose) {
      const result = await payload.find({
        collection: actionCollection,
        where: {
          and: [
            { member: { equals: memberId } },
            { purpose: { equals: purpose } },
            { consumedAt: { exists: false } },
            { invalidatedAt: { exists: false } },
          ],
        },
        limit: 1,
        sort: '-createdAt',
        depth: 0,
        overrideAccess: true,
      })
      const document = result.docs[0] as PayloadDocument | undefined
      return document ? actionRecordFromDocument(document) : null
    },

    async replaceActiveAction(record) {
      await atomicStore.replaceActive(record)
    },

    async findActionByDigest(tokenDigest, purpose) {
      const result = await payload.find({
        collection: actionCollection,
        where: {
          and: [
            { tokenDigest: { equals: tokenDigest } },
            { purpose: { equals: purpose } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const document = result.docs[0] as PayloadDocument | undefined
      return document ? actionRecordFromDocument(document) : null
    },

    async consumeAction(tokenDigest, purpose, consumedAt) {
      return atomicStore.consume(tokenDigest, purpose, consumedAt)
    },

    async recordDelivery(event) {
      await createAuditEvent(payload, {
        actorType: 'system',
        action: `member_account_action.${event.purpose}.${event.status}`,
        targetCollection: actionCollection,
        targetId: event.memberId,
        severity: event.status === 'failed' ? 'warning' : 'info',
        metadata: {
          purpose: event.purpose,
          idempotencyKey: event.idempotencyKey,
          attempt: event.attempt,
          reason: event.reason,
        },
      })
    },
  }
}

export function createQueuedMemberAccountActionTransport(
  payload: PayloadCourseWriteAPI,
): MemberAccountActionTransport {
  const client = resolveQueryClient(payload)
  const schemaName = getMemberEmailVerificationSchema()
  const table = `${quotePgIdentifier(schemaName)}.${quotePgIdentifier(emailEventCollection)}`

  return {
    async send(delivery) {
      const actionUrl = new URL(delivery.actionUrl)
      const dedupeKey = `${delivery.templateKey}:${delivery.memberId}:${delivery.idempotencyKey}`
      const displayName = `${delivery.templateKey} -> ${delivery.to}`
      const metadata = {
        memberId: delivery.memberId,
        purpose: delivery.purpose,
        attempt: delivery.attempt,
        displayName: delivery.displayName,
        actionUrl: actionUrl.toString(),
        logoUrl: `${actionUrl.origin}/images/jpv-logo.png`,
      }

      const existingResult = await client.query(
        `
SELECT "id"
FROM ${table}
WHERE "dedupe_key" = $1::varchar
LIMIT 1;
`,
        [dedupeKey],
      )
      const existingId = existingResult.rows?.[0]?.id
      if (existingId !== null && existingId !== undefined) {
        return { providerMessageId: String(existingId) }
      }

      const insertResult = await client.query(
        `
INSERT INTO ${table} (
  "display_name",
  "to_email",
  "template_key",
  "delivery_status",
  "dedupe_key",
  "metadata"
)
VALUES ($1::varchar, $2::varchar, $3::varchar, 'queued', $4::varchar, $5::jsonb)
RETURNING "id";
`,
        [displayName, delivery.to, delivery.templateKey, dedupeKey, metadata],
      )

      const queuedId = insertResult.rows?.[0]?.id
      if (queuedId !== null && queuedId !== undefined) {
        return { providerMessageId: String(queuedId) }
      }

      if (queuedId === null || queuedId === undefined) {
        throw new Error('Queued member account action email could not be persisted')
      }
      return { providerMessageId: String(queuedId) }
    },
  }
}

export function createPayloadMemberAccountActionService(input: {
  payload: PayloadCourseWriteAPI
  atomicStore: AtomicMemberAccountActionStore
  publicBaseUrl: string
  now?: MemberAccountActionServiceOptions['now']
  randomToken?: MemberAccountActionServiceOptions['randomToken']
}) {
  return createMemberAccountActionService({
    repository: createPayloadMemberAccountActionRepository(input.payload, input.atomicStore),
    transport: createQueuedMemberAccountActionTransport(input.payload),
    publicBaseUrl: input.publicBaseUrl,
    now: input.now,
    randomToken: input.randomToken,
  })
}
