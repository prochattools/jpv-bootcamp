import type { PayloadCourseWriteAPI, PayloadDocument } from '@/lib/payloadCourse/accessService'
import { createAuditEvent, queueEmailEvent } from '@/lib/payloadCourse/events'
import { MEMBER_EMAIL_VERIFICATION_TEMPLATE_KEY } from '@/lib/payloadCourse/systemEmailTemplates'

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
  buildReplaceActiveVerificationSql,
  getMemberEmailVerificationSchema,
} from './memberEmailVerificationSql'

const verificationCollection = 'payload_member_verification_tokens'
const verificationPurpose = 'member_email_verification'

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

export function createPostgresAtomicVerificationStore(
  payload: PayloadCourseWriteAPI,
  databaseUrl = process.env.DATABASE_URL,
): AtomicVerificationStore {
  const client = resolveQueryClient(payload)
  const schemaName = getMemberEmailVerificationSchema(databaseUrl)
  const replaceSql = buildReplaceActiveVerificationSql(schemaName)
  const consumeSql = buildConsumeVerificationSql(schemaName)

  return {
    async replaceActive(record) {
      await client.query(replaceSql, [
        memberIdNumber(record.memberId),
        record.email,
        record.tokenDigest,
        record.expiresAt,
        record.lastSentAt ?? null,
        record.sendAttempts,
        record.createdAt,
        record.idempotencyKey,
      ])
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
  return {
    async send(delivery) {
      const verificationUrl = new URL(delivery.templateData.verificationUrl)
      const { event } = await queueEmailEvent(payload, {
        toEmail: delivery.to,
        templateKey: MEMBER_EMAIL_VERIFICATION_TEMPLATE_KEY,
        dedupeKey: `member-email-verification:${delivery.metadata.memberId}:${delivery.idempotencyKey}`,
        displayName: `Member email verification -> ${delivery.to}`,
        metadata: {
          memberId: delivery.metadata.memberId,
          attempt: delivery.metadata.attempt,
          displayName: delivery.templateData.displayName,
          verificationUrl: verificationUrl.toString(),
          logoUrl: `${verificationUrl.origin}/images/jpv-logo.png`,
        },
      })
      return { providerMessageId: String(event.id) }
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
