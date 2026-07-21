import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

import { escapeEmailHtml, renderBrandedEmail } from '@/lib/communications/brandedEmail'
import { resolveJpvLogoUrl } from '@/lib/brand/jpvDesignSystem'

const DEFAULT_TOKEN_TTL_MS = 60 * 60 * 1000
const DEFAULT_SEND_COOLDOWN_MS = 5 * 60 * 1000
const DEFAULT_MAX_ATTEMPTS = 3

export type VerificationTokenRecord = {
  memberId: string
  email: string
  tokenDigest: string
  expiresAt: string
  createdAt: string
  consumedAt?: string
  lastSentAt?: string
  sendAttempts: number
  idempotencyKey: string
}

export type VerificationMember = {
  id: string
  email: string
  displayName?: string
  emailVerifiedAt?: string
  accountStatus?: string
  source?: string
}

export type VerificationDelivery = {
  to: string
  subject: string
  html: string
  text: string
  idempotencyKey: string
  templateData: {
    displayName: string
    verificationUrl: string
  }
  metadata: {
    memberId: string
    templateKey: 'member_email_verification'
    attempt: number
  }
}

export interface VerificationRepository {
  findMemberByEmail(email: string): Promise<VerificationMember | null>
  findActiveTokenByMemberId(memberId: string): Promise<VerificationTokenRecord | null>
  saveToken(record: VerificationTokenRecord): Promise<void>
  findTokenByDigest(tokenDigest: string): Promise<VerificationTokenRecord | null>
  markTokenConsumed(memberId: string, tokenDigest: string, consumedAt: string): Promise<boolean>
  markMemberVerified(memberId: string, verifiedAt: string): Promise<void>
  recordDelivery(event: {
    memberId: string
    idempotencyKey: string
    status: 'sent' | 'suppressed' | 'failed'
    attempt: number
    occurredAt: string
    reason?: string
  }): Promise<void>
}

export interface VerificationEmailTransport {
  send(delivery: VerificationDelivery): Promise<{ providerMessageId?: string }>
}

export type VerificationServiceOptions = {
  repository: VerificationRepository
  transport: VerificationEmailTransport
  publicBaseUrl: string
  now?: () => Date
  tokenBytes?: number
  tokenTtlMs?: number
  sendCooldownMs?: number
  maxSendAttempts?: number
  randomToken?: () => string
}

export type VerificationRequestResult = {
  accepted: boolean
  message: string
}

export type VerificationCompletionResult =
  | { verified: true; memberId: string }
  | { verified: false; reason: 'invalid_or_expired' | 'already_used' }

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function digestVerificationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function safeTokenDigestEqual(candidateToken: string, expectedDigest: string): boolean {
  const candidate = Buffer.from(digestVerificationToken(candidateToken), 'hex')
  const expected = Buffer.from(expectedDigest, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

export function createVerificationIdempotencyKey(memberId: string, tokenDigest: string): string {
  return createHash('sha256')
    .update(`member-email-verification:${memberId}:${tokenDigest}`, 'utf8')
    .digest('hex')
}

export function buildVerificationEmail(input: {
  email: string
  displayName?: string
  verificationUrl: string
  idempotencyKey: string
  memberId: string
  attempt: number
}): VerificationDelivery {
  const name = input.displayName?.trim() || 'there'
  const subject = 'Verify your JPV Bootcamp email address'
  const verificationUrl = new URL(input.verificationUrl)
  const logoUrl = resolveJpvLogoUrl(verificationUrl)
  const text = [
    `Hi ${name},`,
    '',
    'Please verify your email address to finish securing your JPV Bootcamp member account.',
    verificationUrl.toString(),
    '',
    'This link expires in one hour and can only be used once.',
    'If you did not request this, you can ignore this message.',
  ].join('\n')
  const html = renderBrandedEmail({
    preheader: 'Verify your email address to secure your JPV Bootcamp account.',
    heading: 'Verify your email',
    logoUrl,
    bodyHtml: `<p style="margin:0 0 16px">Hi ${escapeEmailHtml(name)},</p><p style="margin:0 0 16px">Please verify your email address to finish securing your JPV Bootcamp member account.</p><p style="margin:0 0 16px">This link expires in one hour and can only be used once.</p><p style="margin:0">If you did not request this, you can ignore this message.</p>`,
    actions: [{ label: 'Verify email address', url: verificationUrl.toString() }],
  })

  return {
    to: input.email,
    subject,
    html,
    text,
    idempotencyKey: input.idempotencyKey,
    templateData: {
      displayName: name,
      verificationUrl: verificationUrl.toString(),
    },
    metadata: {
      memberId: input.memberId,
      templateKey: 'member_email_verification',
      attempt: input.attempt,
    },
  }
}

export function createMemberEmailVerificationService(options: VerificationServiceOptions) {
  const now = options.now ?? (() => new Date())
  const tokenTtlMs = options.tokenTtlMs ?? DEFAULT_TOKEN_TTL_MS
  const sendCooldownMs = options.sendCooldownMs ?? DEFAULT_SEND_COOLDOWN_MS
  const maxSendAttempts = options.maxSendAttempts ?? DEFAULT_MAX_ATTEMPTS
  const randomToken = options.randomToken ?? (() => randomBytes(options.tokenBytes ?? 32).toString('base64url'))
  const genericMessage = 'If an eligible account exists, a verification email will be sent shortly.'

  async function recordDeliverySafely(event: Parameters<VerificationRepository['recordDelivery']>[0]) {
    try {
      await options.repository.recordDelivery(event)
      return true
    } catch {
      return false
    }
  }

  return {
    async requestVerification(emailInput: string): Promise<VerificationRequestResult> {
      const email = normalizeEmail(emailInput)
      const member = await options.repository.findMemberByEmail(email)
      const eligibleStatus = member?.accountStatus === undefined || member.accountStatus === 'pending' || member.accountStatus === 'active'
      if (!member || member.emailVerifiedAt || !eligibleStatus) {
        return { accepted: true, message: genericMessage }
      }

      const currentTime = now()
      const existing = await options.repository.findActiveTokenByMemberId(member.id)
      if (existing && !existing.consumedAt && new Date(existing.expiresAt).getTime() > currentTime.getTime()) {
        const lastSentAt = existing.lastSentAt ? new Date(existing.lastSentAt).getTime() : 0
        if (lastSentAt && currentTime.getTime() - lastSentAt < sendCooldownMs) {
          await recordDeliverySafely({
            memberId: member.id,
            idempotencyKey: existing.idempotencyKey,
            status: 'suppressed',
            attempt: existing.sendAttempts,
            occurredAt: currentTime.toISOString(),
            reason: 'cooldown',
          })
          return { accepted: true, message: genericMessage }
        }
        if (existing.sendAttempts >= maxSendAttempts) {
          await recordDeliverySafely({
            memberId: member.id,
            idempotencyKey: existing.idempotencyKey,
            status: 'suppressed',
            attempt: existing.sendAttempts,
            occurredAt: currentTime.toISOString(),
            reason: 'max_attempts',
          })
          return { accepted: true, message: genericMessage }
        }
      }

      const token = randomToken()
      const tokenDigest = digestVerificationToken(token)
      const idempotencyKey = createVerificationIdempotencyKey(member.id, tokenDigest)
      const attempt = existing && !existing.consumedAt ? existing.sendAttempts + 1 : 1
      const record: VerificationTokenRecord = {
        memberId: member.id,
        email,
        tokenDigest,
        expiresAt: new Date(currentTime.getTime() + tokenTtlMs).toISOString(),
        createdAt: currentTime.toISOString(),
        lastSentAt: currentTime.toISOString(),
        sendAttempts: attempt,
        idempotencyKey,
      }
      await options.repository.saveToken(record)

      const verificationUrl = new URL('/api/member-email-verification/complete', options.publicBaseUrl)
      verificationUrl.searchParams.set('token', token)
      const delivery = buildVerificationEmail({
        email,
        displayName: member.displayName,
        verificationUrl: verificationUrl.toString(),
        idempotencyKey,
        memberId: member.id,
        attempt,
      })

      try {
        await options.transport.send(delivery)
        await recordDeliverySafely({
          memberId: member.id,
          idempotencyKey,
          status: 'sent',
          attempt,
          occurredAt: currentTime.toISOString(),
        })
      } catch {
        await recordDeliverySafely({
          memberId: member.id,
          idempotencyKey,
          status: 'failed',
          attempt,
          occurredAt: currentTime.toISOString(),
          reason: 'transport_error',
        })
        return { accepted: false, message: genericMessage }
      }

      return { accepted: true, message: genericMessage }
    },

    async completeVerification(token: string): Promise<VerificationCompletionResult> {
      if (!token || token.length < 20) return { verified: false, reason: 'invalid_or_expired' }
      const tokenDigest = digestVerificationToken(token)
      const record = await options.repository.findTokenByDigest(tokenDigest)
      if (!record) return { verified: false, reason: 'invalid_or_expired' }
      if (record.consumedAt) return { verified: false, reason: 'already_used' }
      const currentTime = now()
      if (new Date(record.expiresAt).getTime() <= currentTime.getTime()) {
        return { verified: false, reason: 'invalid_or_expired' }
      }
      if (!safeTokenDigestEqual(token, record.tokenDigest)) {
        return { verified: false, reason: 'invalid_or_expired' }
      }
      const consumed = await options.repository.markTokenConsumed(record.memberId, tokenDigest, currentTime.toISOString())
      if (!consumed) return { verified: false, reason: 'already_used' }
      await options.repository.markMemberVerified(record.memberId, currentTime.toISOString())
      return { verified: true, memberId: record.memberId }
    },
  }
}
