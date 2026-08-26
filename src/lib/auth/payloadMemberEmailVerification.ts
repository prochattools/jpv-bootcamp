import { Client } from 'pg'

import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import { createAuditEvent } from '@/lib/payloadCourse/events'
import { quotePgIdentifier } from '@/lib/payloadMigrationSchema'
import { MEMBER_EMAIL_VERIFICATION_TEMPLATE_KEY } from '@/lib/payloadCourse/systemEmailTemplates'
import { resolveJpvLogoUrl } from '@/lib/brand/jpvDesignSystem'

import {
  createMemberEmailVerificationService,
  type VerificationEmailTransport,
  type VerificationMember,
  type VerificationRepository,
  type VerificationServiceOptions,
  type VerificationTokenRecord,
} from './memberEmailVerification'
import {
  buildConsumeVerificationSql,
  buildInsertVerificationSql,
  buildInvalidateActiveVerificationSql,
  buildReplaceActiveVerificationSql,
  getMemberEmailVerificationSchema,
} from './memberEmailVerificationSql'

const verificationCollection = 'payload_member_verification_tokens'
const verificationPurpose = 'member_email_verification'
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

function toIsoString(value: unknown): string | undefined {
  const stringValue = asString(value)
  if (!stringValue) return undefined
  const date = new Date(stringValue)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function memberIdNumber(memberId: string): number {
  const value = Number(memberId)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error('Member verification requires a positive integer member ID')
  }
  return value
}

function tokenRecordFromDocument(document: PayloadDocument): VerificationTokenRecord | null {
  const member = asString(document.member)
  const tokenDigest = asString(document.tokenDigest)
  const email = asString(document.email)
  const expiresAt = toIsoString(document.expiresAt)
  const createdAt = toIsoString(document.createdAt)
  const idempotencyKey = asString(document.idempotencyKey)
  if (!member || !tokenDigest || !email || !expiresAt || !createdAt || !idempotencyKey) return null

  return {
    memberId: member,
    email,
    tokenDigest,
    expiresAt,
    createdAt,
    consumedAt: toIsoString(document.consumedAt),
    lastSentAt: toIsoString(document.lastSentAt),
    sendAttempts: Number(document.sendAttempts ?? 0),
    idempotencyKey,
  }
}

export type AtomicVerificationStore = {
  replaceActive(record: VerificationTokenRecord): Promise<void>
  consume(tokenDigest: string, consumedAt: string): Promise<string | null>
}

type QueryResult = {
  rows?: Array<Record<string, unknown>>
  rowCount?: number
}

type QueryClient = {
  query(sql: string, values?: readonly unknown[]): Promise<QueryResult>
}

function resolvePayloadQueryClient(payload: PayloadCourseWriteAPI): QueryClient | null {
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

  return null
}

function createPostgresQueryClient(databaseUrl?: string): QueryClient {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for member email verification writes')
  }

  return {
    async query(sql, values) {
      const client = new Client({ connectionString: databaseUrl })
      await client.connect()
      try {
        return (await client.query(sql, values as any[] | undefined)) as unknown as QueryResult
      } finally {
        await client.end()
      }
    },
  }
}

function resolveQueryClient(payload: PayloadCourseWriteAPI): QueryClient {
  const databaseUrl = process.env.DATABASE_URL
  if (process.env.NODE_ENV === 'production') {
    return createPostgresQueryClient(databaseUrl)
  }

  return resolvePayloadQueryClient(payload) ?? createPostgresQueryClient(databaseUrl)
}

export function createPostgresAtomicVerificationStore(
  payload: PayloadCourseWriteAPI,
  databaseUrl = process.env.DATABASE_URL,
  clientOverride?: QueryClient,
): AtomicVerificationStore {
  const client = clientOverride ?? resolveQueryClient(payload)
  const schemaName = getMemberEmailVerificationSchema(databaseUrl)
  const replaceSql = buildReplaceActiveVerificationSql(schemaName)
  const invalidateSql = buildInvalidateActiveVerificationSql(schemaName)
  const insertSql = buildInsertVerificationSql(schemaName)
  const consumeSql = buildConsumeVerificationSql(schemaName)

  return {
    async replaceActive(record) {
      const memberId = memberIdNumber(record.memberId)
      const invalidateValues = [memberId, record.createdAt] as const
      const insertValues = [
        memberId,
        record.email,
        record.tokenDigest,
        record.expiresAt,
        record.lastSentAt ?? null,
        record.sendAttempts,
        record.createdAt,
        record.idempotencyKey,
      ] as const

      if (process.env.NODE_ENV === 'production') {
        await client.query('BEGIN')
        try {
          await client.query(invalidateSql, invalidateValues)
          await client.query(insertSql, insertValues)
          await client.query('COMMIT')
          return
        } catch (error) {
          try {
            await client.query('ROLLBACK')
          } catch {
            // Ignore rollback failures; preserve the original error.
          }
          throw error
        }
      }

      await client.query(replaceSql, insertValues)
    },

    async consume(tokenDigest, consumedAt) {
      const result = await client.query(consumeSql, [tokenDigest, consumedAt])
      const memberId = result.rows?.[0]?.member_id
      return asString(memberId)
    },
  }
}

export function createPayloadVerificationRepository(
  payload: PayloadCourseWriteAPI,
  atomicStore: AtomicVerificationStore,
): VerificationRepository {
  return {
    async findMemberByEmail(email): Promise<VerificationMember | null> {
      const memberResult = await payload.find({
        collection: 'payload_members',
        where: { email: { equals: email } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const member = memberResult.docs[0] as PayloadDocument | undefined
      if (!member) return null

      const memberId = asString(member.id)
      const memberEmail = asString(member.email)
      if (!memberId || !memberEmail) return null

      const profileResult = await payload.find({
        collection: 'payload_member_profiles',
        where: { member: { equals: memberId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const profile = profileResult.docs[0] as PayloadDocument | undefined

      return {
        id: memberId,
        email: memberEmail,
        displayName: asString(profile?.displayName) ?? undefined,
        emailVerifiedAt: toIsoString(member.emailVerifiedAt),
        accountStatus: asString(member.accountStatus) ?? undefined,
        source: asString(member.source) ?? undefined,
      }
    },

    async findActiveTokenByMemberId(memberId) {
      const result = await payload.find({
        collection: verificationCollection,
        where: {
          and: [
            { member: { equals: memberId } },
            { purpose: { equals: verificationPurpose } },
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
      return document ? tokenRecordFromDocument(document) : null
    },

    async saveToken(record) {
      await atomicStore.replaceActive(record)
    },

    async findTokenByDigest(tokenDigest) {
      const result = await payload.find({
        collection: verificationCollection,
        where: { tokenDigest: { equals: tokenDigest } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const document = result.docs[0] as PayloadDocument | undefined
      return document ? tokenRecordFromDocument(document) : null
    },

    async markTokenConsumed(memberId, tokenDigest, consumedAt) {
      const consumedMemberId = await atomicStore.consume(tokenDigest, consumedAt)
      return consumedMemberId === memberId
    },

    async markMemberVerified(memberId, verifiedAt) {
      const memberResult = await payload.find({
        collection: 'payload_members',
        where: { id: { equals: memberId } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const member = memberResult.docs[0] as PayloadDocument | undefined
      const shouldActivate = member?.source === 'self_signup' && member?.accountStatus === 'pending'

      await payload.update({
        collection: 'payload_members',
        id: memberId,
        data: {
          emailVerifiedAt: verifiedAt,
          ...(shouldActivate ? { accountStatus: 'active' } : {}),
        },
        overrideAccess: true,
      })
      await payload.create({
        collection: 'payload_member_security_events',
        data: {
          member: memberId,
          eventType: 'email_verified',
          source: 'member_email_verification',
          metadata: { automaticLogin: false },
        },
        overrideAccess: true,
      })
    },

    async recordDelivery(event) {
      await createAuditEvent(payload, {
        actorType: 'system',
        action: `member_email_verification_${event.status}`,
        targetCollection: verificationCollection,
        targetId: event.memberId,
        severity: event.status === 'failed' ? 'warning' : 'info',
        metadata: {
          idempotencyKey: event.idempotencyKey,
          attempt: event.attempt,
          reason: event.reason,
        },
      })
    },
  }
}

export function createQueuedVerificationEmailTransport(
  payload: PayloadCourseWriteAPI,
): VerificationEmailTransport {
  const client = resolveQueryClient(payload)
  const schemaName = getMemberEmailVerificationSchema()
  const table = `${quotePgIdentifier(schemaName)}.${quotePgIdentifier(emailEventCollection)}`

  return {
    async send(delivery) {
      const verificationUrl = new URL(delivery.templateData.verificationUrl)
      const dedupeKey = `member-email-verification:${delivery.metadata.memberId}:${delivery.idempotencyKey}`
      const displayName = `Member email verification -> ${delivery.to}`
      const metadata = {
        memberId: delivery.metadata.memberId,
        attempt: delivery.metadata.attempt,
        displayName: delivery.templateData.displayName,
        verificationUrl: verificationUrl.toString(),
        logoUrl: resolveJpvLogoUrl(verificationUrl),
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
        [displayName, delivery.to, MEMBER_EMAIL_VERIFICATION_TEMPLATE_KEY, dedupeKey, metadata],
      )

      const queuedId = insertResult.rows?.[0]?.id
      if (queuedId !== null && queuedId !== undefined) {
        return { providerMessageId: String(queuedId) }
      }

      if (queuedId === null || queuedId === undefined) {
        throw new Error('Queued member email verification event could not be persisted')
      }
      return { providerMessageId: String(queuedId) }
    },
  }
}

export function createPayloadMemberEmailVerificationService(input: {
  payload: PayloadCourseWriteAPI
  atomicStore: AtomicVerificationStore
  publicBaseUrl: string
  now?: VerificationServiceOptions['now']
  randomToken?: VerificationServiceOptions['randomToken']
}) {
  return createMemberEmailVerificationService({
    repository: createPayloadVerificationRepository(input.payload, input.atomicStore),
    transport: createQueuedVerificationEmailTransport(input.payload),
    publicBaseUrl: input.publicBaseUrl,
    now: input.now,
    randomToken: input.randomToken,
  })
}
