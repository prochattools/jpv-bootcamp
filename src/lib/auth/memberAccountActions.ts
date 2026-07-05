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
  consumeAction(
    tokenDigest: string,
    purpose: MemberAccountActionPurpose,
    consumedAt: string,
  ): Promise<string | null>
  recordDelivery(event: {
    memberId: string
    purpose: MemberAccountActionPurpose
    idempotencyKey: string
    status: 'sent' | 'suppressed' | 'failed'
    attempt: number
    occurredAt: string
    reason?: 'cooldown' | 'max_attempts' | 'transport_error'
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
  tokenBytes?: number
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

export type CompleteMemberAccountActionResult =
  | { consumed: true; memberId: string; email: string }
  | { consumed: false; reason: 'invalid_or_expired' | 'already_used' }

export type CompletableMemberAccountActionResult =
  | { valid: true; memberId: string; email: string }
  | { valid: false; reason: 'invalid_or_expired' | 'already_used' }

const DEFAULT_SEND_COOLDOWN_MS = 5 * 60 * 1000
const DEFAULT_MAX_SEND_ATTEMPTS = 3

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
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

export function createMemberAccountActionService(options: MemberAccountActionServiceOptions) {
  const now = options.now ?? (() => new Date())
  const randomToken =
    options.randomToken ?? (() => randomBytes(options.tokenBytes ?? 32).toString('base64url'))
  const sendCooldownMs = options.sendCooldownMs ?? DEFAULT_SEND_COOLDOWN_MS
  const maxSendAttempts = options.maxSendAttempts ?? DEFAULT_MAX_SEND_ATTEMPTS

  return {
    async issueAction(
      input: IssueMemberAccountActionInput,
    ): Promise<IssueMemberAccountActionResult> {
      const currentTime = now()
      const existing = await options.repository.findActiveAction(input.memberId, input.purpose)

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

    async findCompletableAction(
      token: string,
      purpose: MemberAccountActionPurpose,
    ): Promise<CompletableMemberAccountActionResult> {
      if (!token || token.length < 20 || token.length > 512) {
        return { valid: false, reason: 'invalid_or_expired' }
      }

      const tokenDigest = digestMemberAccountAction(token)
      const record = await options.repository.findActionByDigest(tokenDigest, purpose)
      if (!record) return { valid: false, reason: 'invalid_or_expired' }
      if (record.consumedAt) return { valid: false, reason: 'already_used' }
      if (record.invalidatedAt || new Date(record.expiresAt).getTime() <= now().getTime()) {
        return { valid: false, reason: 'invalid_or_expired' }
      }
      if (!memberAccountActionDigestMatches(token, record.tokenDigest)) {
        return { valid: false, reason: 'invalid_or_expired' }
      }

      return { valid: true, memberId: record.memberId, email: record.email }
    },

    async completeAction(
      token: string,
      purpose: MemberAccountActionPurpose,
    ): Promise<CompleteMemberAccountActionResult> {
      const completable = await this.findCompletableAction(token, purpose)
      if (completable.valid === false) {
        return { consumed: false, reason: completable.reason }
      }

      const tokenDigest = digestMemberAccountAction(token)
      const record = await options.repository.findActionByDigest(tokenDigest, purpose)
      if (!record) return { consumed: false, reason: 'invalid_or_expired' }

      const consumedAt = now().toISOString()
      const consumedMemberId = await options.repository.consumeAction(
        tokenDigest,
        purpose,
        consumedAt,
      )
      if (!consumedMemberId) return { consumed: false, reason: 'already_used' }
      if (consumedMemberId !== record.memberId) {
        return { consumed: false, reason: 'invalid_or_expired' }
      }

      return {
        consumed: true,
        memberId: record.memberId,
        email: record.email,
      }
    },
  }
}

export type MemberAccountActionService = ReturnType<typeof createMemberAccountActionService>
