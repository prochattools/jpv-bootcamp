import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export type MemberAccountActionPurpose =
  | 'member_invitation'
  | 'set_password'
  | 'password_reset'
  | 'email_change_confirmation'

export type MemberAccountActionRecord = {
  memberId: string
  email: string
  purpose: MemberAccountActionPurpose
  tokenDigest: string
  expiresAt: string
  createdAt: string
  reservationNonce?: string
  reservedAt?: string
  leaseExpiresAt?: string
  resultFingerprint?: string
  consumedAt?: string
  invalidatedAt?: string
  lastSentAt?: string
  sendAttempts: number
  idempotencyKey: string
}

export type MemberAccountActionDelivery = {
  to: string
  templateKey: string
  actionUrl: string
  displayName: string
  memberId: string
  purpose: MemberAccountActionPurpose
  idempotencyKey: string
  attempt: number
}

export type ReservedMemberAccountActionRecord = {
  memberId: string
  email: string
  reservationNonce: string
  reservedAt: string
  leaseExpiresAt: string
  resultFingerprint?: string
  reclaimed: boolean
}

export type FinalizedMemberAccountActionRecord = {
  memberId: string
  email: string
  resultFingerprint: string
  consumedAt: string
}

export type CompletedMemberAccountActionRecord = FinalizedMemberAccountActionRecord

export interface MemberAccountActionRepository {
  findActiveAction(
    memberId: string,
    purpose: MemberAccountActionPurpose,
  ): Promise<MemberAccountActionRecord | null>
  replaceActiveAction(record: MemberAccountActionRecord): Promise<void>
  findActionByDigest(
    tokenDigest: string,
    purpose: MemberAccountActionPurpose,
  ): Promise<MemberAccountActionRecord | null>
  reserveAction(input: {
    tokenDigest: string
    purpose: MemberAccountActionPurpose
    reservationNonce: string
    leaseDurationMs: number
  }): Promise<ReservedMemberAccountActionRecord | null>
  markMutationStarted(input: {
    tokenDigest: string
    purpose: MemberAccountActionPurpose
    reservationNonce: string
    resultFingerprint: string
  }): Promise<boolean>
  finalizeAction(input: {
    tokenDigest: string
    purpose: MemberAccountActionPurpose
    reservationNonce: string
    resultFingerprint: string
  }): Promise<FinalizedMemberAccountActionRecord | null>
  releaseAction(input: {
    tokenDigest: string
    purpose: MemberAccountActionPurpose
    reservationNonce: string
  }): Promise<boolean>
  findCompletedAction(
    tokenDigest: string,
    purpose: MemberAccountActionPurpose,
  ): Promise<CompletedMemberAccountActionRecord | null>
  recordDelivery(event: {
    memberId: string
    purpose: MemberAccountActionPurpose
    idempotencyKey: string
    status: 'sent' | 'suppressed' | 'failed'
    attempt: number
    occurredAt: string
    reason?: 'cooldown' | 'max_attempts' | 'transport_error' | 'in_progress'
  }): Promise<void>
}

export interface MemberAccountActionTransport {
  send(delivery: MemberAccountActionDelivery): Promise<{ providerMessageId?: string }>
}

export type MemberAccountActionServiceOptions = {
  repository: MemberAccountActionRepository
  transport: MemberAccountActionTransport
  publicBaseUrl: string
  now?: () => Date
  randomToken?: () => string
  randomReservationNonce?: () => string
  tokenBytes?: number
  reservationLeaseMs?: number
  sendCooldownMs?: number
  maxSendAttempts?: number
}

export type IssueMemberAccountActionInput = {
  memberId: string
  email: string
  displayName?: string | null
  purpose: MemberAccountActionPurpose
  templateKey: string
  actionPath: string
  ttlMs: number
}

export type IssueMemberAccountActionResult = {
  accepted: true
  delivery: 'queued' | 'suppressed' | 'failed'
}

export type ReserveMemberAccountActionResult =
  | {
      reserved: true
      memberId: string
      email: string
      reservationNonce: string
      reservedAt: string
      leaseExpiresAt: string
      resultFingerprint?: string
      reclaimed: boolean
    }
  | {
      reserved: false
      reason: 'invalid_or_expired' | 'already_reserved' | 'already_consumed'
      memberId?: string
      email?: string
      resultFingerprint?: string
      leaseExpiresAt?: string
    }

export type FinalizeMemberAccountActionResult =
  | {
      finalized: true
      memberId: string
      email: string
      resultFingerprint: string
      replayed: boolean
    }
  | {
      finalized: false
      reason: 'invalid_reservation' | 'result_conflict' | 'invalid_or_expired'
    }

export type ReleaseMemberAccountActionResult = {
  released: boolean
}

const DEFAULT_SEND_COOLDOWN_MS = 5 * 60 * 1000
const DEFAULT_MAX_SEND_ATTEMPTS = 3
const DEFAULT_RESERVATION_LEASE_MS = 30 * 1000
const SAFE_RESULT_KEY = /^[a-z0-9:_-]{1,128}$/

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

function validActionToken(token: string): boolean {
  return token.length >= 20 && token.length <= 512
}

export function digestMemberAccountAction(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function memberAccountActionDigestMatches(token: string, expectedDigest: string): boolean {
  const candidate = Buffer.from(digestMemberAccountAction(token), 'hex')
  const expected = Buffer.from(expectedDigest, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

export function createMemberAccountActionIdempotencyKey(
  memberId: string,
  purpose: MemberAccountActionPurpose,
  tokenDigest: string,
): string {
  return createHash('sha256')
    .update(`member-account-action:${memberId}:${purpose}:${tokenDigest}`, 'utf8')
    .digest('hex')
}

export function createMemberAccountActionResultFingerprint(
  token: string,
  purpose: MemberAccountActionPurpose,
  resultKey: string,
): string {
  const normalizedResultKey = resultKey.trim().toLowerCase()
  if (!SAFE_RESULT_KEY.test(normalizedResultKey)) {
    throw new Error('Member account action result key must be non-sensitive and identifier-safe')
  }
  return createHash('sha256')
    .update(
      `member-account-action-result:v1:${digestMemberAccountAction(token)}:${purpose}:${normalizedResultKey}`,
      'utf8',
    )
    .digest('hex')
}

export function createMemberAccountActionService(options: MemberAccountActionServiceOptions) {
  const now = options.now ?? (() => new Date())
  const randomToken = options.randomToken ?? (() => randomBytes(options.tokenBytes ?? 32).toString('base64url'))
  const randomReservationNonce = options.randomReservationNonce ?? (() => randomBytes(24).toString('base64url'))
  const reservationLeaseMs = options.reservationLeaseMs ?? DEFAULT_RESERVATION_LEASE_MS
  const sendCooldownMs = options.sendCooldownMs ?? DEFAULT_SEND_COOLDOWN_MS
  const maxSendAttempts = options.maxSendAttempts ?? DEFAULT_MAX_SEND_ATTEMPTS

  if (!Number.isSafeInteger(reservationLeaseMs) || reservationLeaseMs < 1_000 || reservationLeaseMs > 15 * 60 * 1000) {
    throw new Error('Member account action reservation lease must be between 1 second and 15 minutes')
  }

  return {
    async issueAction(
      input: IssueMemberAccountActionInput,
    ): Promise<IssueMemberAccountActionResult> {
      const currentTime = now()
      const existing = await options.repository.findActiveAction(input.memberId, input.purpose)

      if (
        existing?.resultFingerprint ||
        (
          existing?.reservationNonce &&
          existing.leaseExpiresAt &&
          new Date(existing.leaseExpiresAt).getTime() > currentTime.getTime()
        )
      ) {
        await options.repository.recordDelivery({
          memberId: input.memberId,
          purpose: input.purpose,
          idempotencyKey: existing.idempotencyKey,
          status: 'suppressed',
          attempt: existing.sendAttempts,
          occurredAt: currentTime.toISOString(),
          reason: 'in_progress',
        })
        return { accepted: true, delivery: 'suppressed' }
      }

      if (
        existing &&
        !existing.consumedAt &&
        !existing.invalidatedAt &&
        new Date(existing.expiresAt).getTime() > currentTime.getTime()
      ) {
        const lastSentAt = existing.lastSentAt ? new Date(existing.lastSentAt).getTime() : 0
        if (lastSentAt && currentTime.getTime() - lastSentAt < sendCooldownMs) {
          await options.repository.recordDelivery({
            memberId: input.memberId,
            purpose: input.purpose,
            idempotencyKey: existing.idempotencyKey,
            status: 'suppressed',
            attempt: existing.sendAttempts,
            occurredAt: currentTime.toISOString(),
            reason: 'cooldown',
          })
          return { accepted: true, delivery: 'suppressed' }
        }
        if (input.purpose !== 'password_reset' && existing.sendAttempts >= maxSendAttempts) {
          await options.repository.recordDelivery({
            memberId: input.memberId,
            purpose: input.purpose,
            idempotencyKey: existing.idempotencyKey,
            status: 'suppressed',
            attempt: existing.sendAttempts,
            occurredAt: currentTime.toISOString(),
            reason: 'max_attempts',
          })
          return { accepted: true, delivery: 'suppressed' }
        }
      }

      const token = randomToken()
      const tokenDigest = digestMemberAccountAction(token)
      const idempotencyKey = createMemberAccountActionIdempotencyKey(
        input.memberId,
        input.purpose,
        tokenDigest,
      )
      const attempt = existing && !existing.consumedAt && !existing.invalidatedAt
        ? existing.sendAttempts + 1
        : 1
      const record: MemberAccountActionRecord = {
        memberId: input.memberId,
        email: normalizeEmail(input.email),
        purpose: input.purpose,
        tokenDigest,
        expiresAt: new Date(currentTime.getTime() + input.ttlMs).toISOString(),
        createdAt: currentTime.toISOString(),
        lastSentAt: currentTime.toISOString(),
        sendAttempts: attempt,
        idempotencyKey,
      }
      await options.repository.replaceActiveAction(record)

      const actionUrl = new URL(input.actionPath, options.publicBaseUrl)
      actionUrl.searchParams.set('token', token)

      try {
        await options.transport.send({
          to: record.email,
          templateKey: input.templateKey,
          actionUrl: actionUrl.toString(),
          displayName: input.displayName?.trim() || 'there',
          memberId: input.memberId,
          purpose: input.purpose,
          idempotencyKey,
          attempt,
        })
        await options.repository.recordDelivery({
          memberId: input.memberId,
          purpose: input.purpose,
          idempotencyKey,
          status: 'sent',
          attempt,
          occurredAt: currentTime.toISOString(),
        })
        return { accepted: true, delivery: 'queued' }
      } catch {
        await options.repository.recordDelivery({
          memberId: input.memberId,
          purpose: input.purpose,
          idempotencyKey,
          status: 'failed',
          attempt,
          occurredAt: currentTime.toISOString(),
          reason: 'transport_error',
        })
        return { accepted: true, delivery: 'failed' }
      }
    },

    async reserveAction(
      token: string,
      purpose: MemberAccountActionPurpose,
    ): Promise<ReserveMemberAccountActionResult> {
      if (!validActionToken(token)) {
        return { reserved: false, reason: 'invalid_or_expired' }
      }

      const tokenDigest = digestMemberAccountAction(token)
      const reservationNonce = randomReservationNonce()
      if (!reservationNonce || reservationNonce.length > 64) {
        throw new Error('Member account action reservation nonce is invalid')
      }

      const reserved = await options.repository.reserveAction({
        tokenDigest,
        purpose,
        reservationNonce,
        leaseDurationMs: reservationLeaseMs,
      })
      if (reserved) {
        return {
          reserved: true,
          memberId: reserved.memberId,
          email: reserved.email,
          reservationNonce: reserved.reservationNonce,
          reservedAt: reserved.reservedAt,
          leaseExpiresAt: reserved.leaseExpiresAt,
          resultFingerprint: reserved.resultFingerprint,
          reclaimed: reserved.reclaimed,
        }
      }

      const completed = await options.repository.findCompletedAction(tokenDigest, purpose)
      if (completed) {
        return {
          reserved: false,
          reason: 'already_consumed',
          memberId: completed.memberId,
          email: completed.email,
          resultFingerprint: completed.resultFingerprint,
        }
      }

      const record = await options.repository.findActionByDigest(tokenDigest, purpose)
      if (!record || !memberAccountActionDigestMatches(token, record.tokenDigest)) {
        return { reserved: false, reason: 'invalid_or_expired' }
      }
      if (record.invalidatedAt || new Date(record.expiresAt).getTime() <= now().getTime()) {
        return { reserved: false, reason: 'invalid_or_expired' }
      }
      if (
        record.reservationNonce &&
        record.leaseExpiresAt &&
        new Date(record.leaseExpiresAt).getTime() > now().getTime()
      ) {
        return {
          reserved: false,
          reason: 'already_reserved',
          memberId: record.memberId,
          leaseExpiresAt: record.leaseExpiresAt,
        }
      }
      return { reserved: false, reason: 'already_reserved', memberId: record.memberId }
    },

    async markMutationStarted(
      token: string,
      purpose: MemberAccountActionPurpose,
      reservationNonce: string,
      resultKey: string,
    ): Promise<{ marked: boolean; resultFingerprint?: string }> {
      if (!validActionToken(token) || !reservationNonce) return { marked: false }
      const resultFingerprint = createMemberAccountActionResultFingerprint(token, purpose, resultKey)
      const marked = await options.repository.markMutationStarted({
        tokenDigest: digestMemberAccountAction(token),
        purpose,
        reservationNonce,
        resultFingerprint,
      })
      return marked ? { marked: true, resultFingerprint } : { marked: false }
    },

    async finalizeAction(
      token: string,
      purpose: MemberAccountActionPurpose,
      reservationNonce: string,
      resultKey: string,
    ): Promise<FinalizeMemberAccountActionResult> {
      if (!validActionToken(token) || !reservationNonce) {
        return { finalized: false, reason: 'invalid_reservation' }
      }
      const tokenDigest = digestMemberAccountAction(token)
      const resultFingerprint = createMemberAccountActionResultFingerprint(token, purpose, resultKey)
      const finalized = await options.repository.finalizeAction({
        tokenDigest,
        purpose,
        reservationNonce,
        resultFingerprint,
      })
      if (finalized) {
        return {
          finalized: true,
          memberId: finalized.memberId,
          email: finalized.email,
          resultFingerprint: finalized.resultFingerprint,
          replayed: false,
        }
      }

      const completed = await options.repository.findCompletedAction(tokenDigest, purpose)
      if (completed) {
        if (completed.resultFingerprint === resultFingerprint) {
          return {
            finalized: true,
            memberId: completed.memberId,
            email: completed.email,
            resultFingerprint: completed.resultFingerprint,
            replayed: true,
          }
        }
        return { finalized: false, reason: 'result_conflict' }
      }

      const record = await options.repository.findActionByDigest(tokenDigest, purpose)
      if (!record || record.invalidatedAt || new Date(record.expiresAt).getTime() <= now().getTime()) {
        return { finalized: false, reason: 'invalid_or_expired' }
      }
      return { finalized: false, reason: 'invalid_reservation' }
    },

    async releaseAction(
      token: string,
      purpose: MemberAccountActionPurpose,
      reservationNonce: string,
    ): Promise<ReleaseMemberAccountActionResult> {
      if (!validActionToken(token) || !reservationNonce) return { released: false }
      return {
        released: await options.repository.releaseAction({
          tokenDigest: digestMemberAccountAction(token),
          purpose,
          reservationNonce,
        }),
      }
    },

    isCompletedResult(
      token: string,
      purpose: MemberAccountActionPurpose,
      resultKey: string,
      resultFingerprint: string | undefined,
    ): boolean {
      if (!validActionToken(token) || !resultFingerprint) return false
      const candidate = Buffer.from(
        createMemberAccountActionResultFingerprint(token, purpose, resultKey),
        'hex',
      )
      const expected = Buffer.from(resultFingerprint, 'hex')
      return candidate.length === expected.length && timingSafeEqual(candidate, expected)
    },
  }
}

export type MemberAccountActionService = ReturnType<typeof createMemberAccountActionService>
