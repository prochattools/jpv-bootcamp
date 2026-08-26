import assert from 'node:assert/strict'

import { jpvBrand } from '../src/lib/brand/jpvDesignSystem'

import {
  buildVerificationEmail,
  createMemberEmailVerificationService,
  digestVerificationToken,
  safeTokenDigestEqual,
  type VerificationDelivery,
  type VerificationMember,
  type VerificationRepository,
  type VerificationTokenRecord,
} from '../src/lib/auth/memberEmailVerification'

class MemoryVerificationRepository implements VerificationRepository {
  members = new Map<string, VerificationMember>()
  tokens = new Map<string, VerificationTokenRecord>()
  deliveries: Array<{
    memberId: string
    idempotencyKey: string
    status: 'sent' | 'suppressed' | 'failed'
    attempt: number
    occurredAt: string
    reason?: string
  }> = []
  failDeliveryRecording = false

  async findMemberByEmail(email: string) {
    return [...this.members.values()].find((member) => member.email.toLowerCase() === email.toLowerCase()) ?? null
  }

  async findActiveTokenByMemberId(memberId: string) {
    return [...this.tokens.values()].find((record) => record.memberId === memberId && !record.consumedAt) ?? null
  }

  async saveToken(record: VerificationTokenRecord) {
    this.tokens.set(record.tokenDigest, structuredClone(record))
  }

  async findTokenByDigest(tokenDigest: string) {
    const record = this.tokens.get(tokenDigest)
    return record ? structuredClone(record) : null
  }

  async markTokenConsumed(memberId: string, tokenDigest: string, consumedAt: string) {
    const record = this.tokens.get(tokenDigest)
    if (!record || record.memberId !== memberId || record.consumedAt) return false
    record.consumedAt = consumedAt
    return true
  }

  async markMemberVerified(memberId: string, verifiedAt: string) {
    const member = this.members.get(memberId)
    if (!member) throw new Error('member missing')
    member.emailVerifiedAt = verifiedAt
    if (member.source === 'self_signup' && member.accountStatus === 'pending') {
      member.accountStatus = 'active'
    }
  }

  async recordDelivery(event: (typeof this.deliveries)[number]) {
    if (this.failDeliveryRecording) throw new Error('delivery recording failure')
    this.deliveries.push(structuredClone(event))
  }
}

class FakeVerificationTransport {
  deliveries: VerificationDelivery[] = []
  fail = false

  async send(delivery: VerificationDelivery) {
    this.deliveries.push(structuredClone(delivery))
    if (this.fail) throw new Error('fake transport failure')
    return { providerMessageId: `fake-${this.deliveries.length}` }
  }
}

function createFixture(input?: {
  now?: string
  token?: string
  cooldownMs?: number
  maxAttempts?: number
}) {
  let currentTime = new Date(input?.now ?? '2026-07-01T12:00:00.000Z')
  const repository = new MemoryVerificationRepository()
  const transport = new FakeVerificationTransport()
  repository.members.set('member-1', {
    id: 'member-1',
    email: 'student@example.test',
    displayName: 'Student',
    accountStatus: 'pending',
    source: 'self_signup',
  })
  const service = createMemberEmailVerificationService({
    repository,
    transport,
    publicBaseUrl: 'https://preview.jpvbootcamp.test',
    now: () => new Date(currentTime),
    randomToken: () => input?.token ?? 'verification-token-value-that-is-never-stored',
    sendCooldownMs: input?.cooldownMs ?? 5 * 60 * 1000,
    maxSendAttempts: input?.maxAttempts ?? 3,
  })
  return {
    repository,
    transport,
    service,
    advance(ms: number) {
      currentTime = new Date(currentTime.getTime() + ms)
    },
  }
}

async function run() {
  const rawToken = 'verification-token-value-that-is-never-stored'
  const digest = digestVerificationToken(rawToken)
  assert.notEqual(digest, rawToken)
  assert.equal(digest.length, 64)
  assert.equal(safeTokenDigestEqual(rawToken, digest), true)
  assert.equal(safeTokenDigestEqual(`${rawToken}-wrong`, digest), false)

  const fixture = createFixture({ token: rawToken })
  const firstResult = await fixture.service.requestVerification(' Student@Example.Test ')
  assert.equal(firstResult.accepted, true)
  assert.match(firstResult.message, /If an eligible account exists/)
  assert.equal(fixture.transport.deliveries.length, 1)
  assert.equal(fixture.repository.tokens.size, 1)

  const stored = [...fixture.repository.tokens.values()][0]
  assert(stored)
  assert.equal(stored.email, 'student@example.test')
  assert.equal(stored.tokenDigest, digest)
  assert.equal(JSON.stringify(stored).includes(rawToken), false)
  assert.equal(stored.sendAttempts, 1)
  assert.equal(stored.consumedAt, undefined)
  assert.equal(new Date(stored.expiresAt).getTime() - new Date(stored.createdAt).getTime(), 60 * 60 * 1000)

  const delivery = fixture.transport.deliveries[0]
  assert(delivery)
  assert.equal(delivery.to, 'student@example.test')
  assert.match(delivery.subject, /Verify your JPV Bootcamp email/)
  assert.match(delivery.html, /JPV/)
  assert.match(delivery.html, /Verify email address/)
  assert.match(delivery.text, /This link expires in one hour/)
  assert.match(delivery.text, /verification-token-value-that-is-never-stored/)
  assert.equal(delivery.templateData.displayName, 'Student')
  assert.match(delivery.templateData.verificationUrl, /member-email-verification\/complete/)
  assert.equal(delivery.idempotencyKey, stored.idempotencyKey)
  assert.equal(fixture.repository.deliveries[0]?.status, 'sent')

  const duplicateResult = await fixture.service.requestVerification('student@example.test')
  assert.deepEqual(duplicateResult, firstResult)
  assert.equal(fixture.transport.deliveries.length, 1)
  assert.equal(fixture.repository.deliveries.at(-1)?.status, 'suppressed')
  assert.equal(fixture.repository.deliveries.at(-1)?.reason, 'cooldown')

  const resilientFixture = createFixture({ token: 'resilient-token-value-that-is-long-enough' })
  resilientFixture.repository.failDeliveryRecording = true
  const resilientResult = await resilientFixture.service.requestVerification('student@example.test')
  assert.deepEqual(resilientResult, firstResult)
  assert.equal(resilientFixture.transport.deliveries.length, 1)
  assert.equal(resilientFixture.repository.tokens.size, 1)
  assert.equal(resilientFixture.repository.deliveries.length, 0)

  const unknown = await fixture.service.requestVerification('unknown@example.test')
  assert.deepEqual(unknown, firstResult)
  assert.equal(fixture.transport.deliveries.length, 1)

  const blockedFixture = createFixture({ token: 'blocked-token-value-that-is-long-enough' })
  const blockedMember = blockedFixture.repository.members.get('member-1')
  assert(blockedMember)
  blockedMember.accountStatus = 'blocked'
  const blocked = await blockedFixture.service.requestVerification('student@example.test')
  assert.deepEqual(blocked, firstResult)
  assert.equal(blockedFixture.transport.deliveries.length, 0)
  assert.equal(blockedFixture.repository.tokens.size, 0)

  const invalid = await fixture.service.completeVerification('invalid')
  assert.deepEqual(invalid, { verified: false, reason: 'invalid_or_expired' })

  const completed = await fixture.service.completeVerification(rawToken)
  assert.deepEqual(completed, { verified: true, memberId: 'member-1' })
  assert(fixture.repository.members.get('member-1')?.emailVerifiedAt)
  assert.equal(fixture.repository.members.get('member-1')?.accountStatus, 'active')
  assert(fixture.repository.tokens.get(digest)?.consumedAt)

  const reused = await fixture.service.completeVerification(rawToken)
  assert.deepEqual(reused, { verified: false, reason: 'already_used' })

  const expiredFixture = createFixture({ token: 'expired-token-value-that-is-long-enough' })
  await expiredFixture.service.requestVerification('student@example.test')
  expiredFixture.advance(60 * 60 * 1000 + 1)
  const expired = await expiredFixture.service.completeVerification('expired-token-value-that-is-long-enough')
  assert.deepEqual(expired, { verified: false, reason: 'invalid_or_expired' })

  const retryFixture = createFixture({
    token: 'retry-token-value-that-is-long-enough',
    cooldownMs: 1,
    maxAttempts: 2,
  })
  retryFixture.transport.fail = true
  await retryFixture.service.requestVerification('student@example.test')
  retryFixture.advance(2)
  await retryFixture.service.requestVerification('student@example.test')
  retryFixture.advance(2)
  await retryFixture.service.requestVerification('student@example.test')
  assert.equal(retryFixture.transport.deliveries.length, 2)
  assert.equal(retryFixture.repository.deliveries.at(-1)?.status, 'suppressed')
  assert.equal(retryFixture.repository.deliveries.at(-1)?.reason, 'max_attempts')
  assert.equal(retryFixture.repository.deliveries.filter((event) => event.status === 'failed').length, 2)

  const template = buildVerificationEmail({
    email: 'member@example.test',
    displayName: 'Member',
    verificationUrl: 'https://preview.jpvbootcamp.test/api/member-email-verification/complete?token=redacted',
    idempotencyKey: 'idempotency-key',
    memberId: 'member-2',
    attempt: 1,
  })
  assert.ok(template.html.includes(jpvBrand.logoPath), 'verification email must use the canonical JPV logo')
  assert.match(template.text, /Member/)
  assert.equal(template.metadata.templateKey, 'member_email_verification')

  const escapedTemplate = buildVerificationEmail({
    email: 'member@example.test',
    displayName: '<script>alert(1)</script>',
    verificationUrl: 'https://preview.jpvbootcamp.test/api/member-email-verification/complete?token=redacted',
    idempotencyKey: 'escaped-idempotency-key',
    memberId: 'member-3',
    attempt: 1,
  })
  assert.doesNotMatch(escapedTemplate.html, /<script>/)
  assert.match(escapedTemplate.html, /&lt;script&gt;/)

  console.log('member email verification checks passed')
}

void run()
