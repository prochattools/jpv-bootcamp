import assert from 'node:assert/strict'

import { PayloadMemberVerificationRecords } from '../src/collections/members/MemberEmailVerificationRecords'
import {
  createMemberAccountActionService,
  digestMemberAccountAction,
  type MemberAccountActionDelivery,
} from '../src/lib/auth/memberAccountActions'
import { MemoryMemberAccountActionRepository } from './helpers/memberAccountActionMemoryRepository'
import { createQueuedMemberAccountActionTransport } from '../src/lib/auth/payloadMemberAccountActions'
import {
  MEMBER_ACCOUNT_ACTION_PURPOSES,
  MEMBER_ACCOUNT_SECURITY_EVENTS,
  buildMemberAccountActionPurposeDownSql,
  buildMemberAccountActionPurposeUpSql,
} from '../src/lib/auth/memberAccountActionMigrationSql'
import {
  buildFinalizeMemberAccountActionSql,
  buildFindCompletedMemberAccountActionSql,
  buildMarkMemberAccountActionMutationStartedSql,
  buildReleaseMemberAccountActionSql,
  buildReplaceActiveMemberAccountActionSql,
  buildReserveMemberAccountActionSql,
} from '../src/lib/auth/memberAccountActionSql'
import {
  buildMemberAccountActionReservationDownSql,
  buildMemberAccountActionReservationUpSql,
} from '../src/lib/auth/memberAccountActionReservationMigrationSql'
import { PAYLOAD_MIGRATION_NAMES } from '../src/migrations/migrationRegistry'

process.env.DATABASE_URL ??= 'postgresql://redacted.invalid/app?schema=jpvbootcamp_staging'

class MemoryActionRepository extends MemoryMemberAccountActionRepository {}

class FakeTransport {
  sent: MemberAccountActionDelivery[] = []
  fail = false

  async send(delivery: MemberAccountActionDelivery) {
    this.sent.push(structuredClone(delivery))
    if (this.fail) throw new Error('fake transport failure')
    return { providerMessageId: `fake-${this.sent.length}` }
  }
}

class FakePayload {
  events: Array<Record<string, unknown>> = []
  queries: string[] = []

  db = {
    pool: {
      query: async (sql: string, values?: readonly unknown[]) => this.handleQuery(sql, values),
    },
  }

  private handleQuery(sql: string, values?: readonly unknown[]) {
    this.queries.push(sql)
    if (sql.includes('INSERT INTO') && sql.includes('payload_email_events')) {
      const dedupeKey = String(values?.[3] ?? '')
      const existing = this.events.find((event) => event.dedupe_key === dedupeKey)
      if (existing) return { rows: [], rowCount: 0 }

      const event = {
        id: `email_${this.events.length + 1}`,
        display_name: values?.[0],
        to_email: values?.[1],
        template_key: values?.[2],
        delivery_status: 'queued',
        dedupe_key: dedupeKey,
        metadata: values?.[4],
      }
      this.events.push(event)
      return { rows: [{ id: event.id }], rowCount: 1 }
    }

    if (sql.includes('SELECT "id"') && sql.includes('payload_email_events')) {
      const dedupeKey = String(values?.[0] ?? '')
      const event = this.events.find((candidate) => candidate.dedupe_key === dedupeKey)
      return { rows: event ? [{ id: event.id }] : [], rowCount: event ? 1 : 0 }
    }

    throw new Error(`Unhandled query: ${sql}`)
  }
}

async function run() {
  let now = new Date('2026-07-02T00:00:00.000Z')
  const repository = new MemoryActionRepository(() => new Date(now))
  const transport = new FakeTransport()
  let nextToken = 'member-invitation-token-value-that-is-never-stored'
  const service = createMemberAccountActionService({
    repository,
    transport,
    publicBaseUrl: 'https://preview.jpvbootcamp.test',
    now: () => new Date(now),
    randomToken: () => nextToken,
    sendCooldownMs: 60_000,
    maxSendAttempts: 2,
  })

  const issued = await service.issueAction({
    memberId: '1',
    email: ' Student@Example.Test ',
    displayName: 'Student',
    purpose: 'member_invitation',
    templateKey: 'member-invitation',
    actionPath: '/set-password',
    ttlMs: 60 * 60 * 1000,
  })
  assert.deepEqual(issued, { accepted: true, delivery: 'queued' })
  assert.equal(repository.records.length, 1)
  assert.equal(transport.sent.length, 1)
  const first = repository.records[0]
  assert(first)
  assert.equal(first.email, 'student@example.test')
  assert.equal(first.purpose, 'member_invitation')
  assert.equal(first.tokenDigest, digestMemberAccountAction(nextToken))
  assert.equal(JSON.stringify(first).includes(nextToken), false)
  assert.match(transport.sent[0]?.actionUrl ?? '', /set-password/)
  assert.equal(transport.sent[0]?.purpose, 'member_invitation')

  const cooldown = await service.issueAction({
    memberId: '1',
    email: 'student@example.test',
    purpose: 'member_invitation',
    templateKey: 'member-invitation',
    actionPath: '/set-password',
    ttlMs: 60 * 60 * 1000,
  })
  assert.equal(cooldown.delivery, 'suppressed')
  assert.equal(transport.sent.length, 1)
  assert.equal(repository.deliveries.at(-1)?.reason, 'cooldown')

  now = new Date(now.getTime() + 60_001)
  const secondInviteToken = 'second-member-invitation-token-that-is-never-stored'
  nextToken = secondInviteToken
  const secondInvite = await service.issueAction({
    memberId: '1',
    email: 'student@example.test',
    purpose: 'member_invitation',
    templateKey: 'member-invitation',
    actionPath: '/set-password',
    ttlMs: 60 * 60 * 1000,
  })
  assert.equal(secondInvite.delivery, 'queued')
  assert.equal(transport.sent.length, 2)

  now = new Date(now.getTime() + 60_001)
  nextToken = 'third-member-invitation-token-that-is-never-stored'
  const maxInvite = await service.issueAction({
    memberId: '1',
    email: 'student@example.test',
    purpose: 'member_invitation',
    templateKey: 'member-invitation',
    actionPath: '/set-password',
    ttlMs: 60 * 60 * 1000,
  })
  assert.equal(maxInvite.delivery, 'suppressed')
  assert.equal(repository.deliveries.at(-1)?.reason, 'max_attempts')
  assert.equal(transport.sent.length, 2)

  nextToken = secondInviteToken
  const wrongPurpose = await service.reserveAction(nextToken, 'password_reset')
  assert.deepEqual(wrongPurpose, { reserved: false, reason: 'invalid_or_expired' })

  const [winner, loser] = await Promise.all([
    service.reserveAction(nextToken, 'member_invitation'),
    service.reserveAction(nextToken, 'member_invitation'),
  ])
  const reserved = [winner, loser].find((result) => result.reserved)
  const blocked = [winner, loser].find((result) => !result.reserved)
  assert(reserved?.reserved)
  assert.equal(blocked?.reserved, false)
  if (blocked?.reserved === false) assert.equal(blocked.reason, 'already_reserved')

  const wrongFinalize = await service.finalizeAction(
    nextToken,
    'member_invitation',
    'wrong-reservation-nonce',
    'member-active',
  )
  assert.deepEqual(wrongFinalize, { finalized: false, reason: 'invalid_reservation' })
  assert.deepEqual(
    await service.releaseAction(nextToken, 'member_invitation', 'wrong-reservation-nonce'),
    { released: false },
  )

  const finalizedToken = nextToken
  assert.deepEqual(
    await service.markMutationStarted(
      finalizedToken,
      'member_invitation',
      'wrong-reservation-nonce',
      'member-active',
    ),
    { marked: false },
  )
  const mutationMarker = await service.markMutationStarted(
    finalizedToken,
    'member_invitation',
    reserved.reservationNonce,
    'member-active',
  )
  assert.equal(mutationMarker.marked, true)
  assert.equal(mutationMarker.resultFingerprint?.includes(finalizedToken), false)

  const finalized = await service.finalizeAction(
    finalizedToken,
    'member_invitation',
    reserved.reservationNonce,
    'member-active',
  )
  assert.equal(finalized.finalized, true)
  const replay = await service.finalizeAction(
    nextToken,
    'member_invitation',
    reserved.reservationNonce,
    'member-active',
  )
  assert.equal(replay.finalized, true)
  if (replay.finalized) assert.equal(replay.replayed, true)
  assert.deepEqual(
    await service.finalizeAction(
      nextToken,
      'member_invitation',
      reserved.reservationNonce,
      'different-result',
    ),
    { finalized: false, reason: 'result_conflict' },
  )
  assert.equal(JSON.stringify(repository.records).includes(nextToken), false)

  nextToken = 'password-reset-token-value-that-is-never-stored'
  const consumedReservation = await service.reserveAction(finalizedToken, 'member_invitation')
  assert.equal(consumedReservation.reserved, false)
  if (!consumedReservation.reserved) assert.equal(consumedReservation.reason, 'already_consumed')

  const leaseToken = 'lease-account-action-token-value'
  nextToken = leaseToken
  now = new Date(now.getTime() + 1)
  await service.issueAction({
    memberId: 'lease-member',
    email: 'lease@example.test',
    purpose: 'email_change_confirmation',
    templateKey: 'member-email-change-confirmation',
    actionPath: '/confirm-email-change',
    ttlMs: 60 * 60 * 1000,
  })
  const firstLease = await service.reserveAction(leaseToken, 'email_change_confirmation')
  assert(firstLease.reserved)
  const leaseMarker = await service.markMutationStarted(
    leaseToken,
    'email_change_confirmation',
    firstLease.reservationNonce,
    'email:lease-result',
  )
  assert.equal(leaseMarker.marked, true)
  const blockedLease = await service.reserveAction(leaseToken, 'email_change_confirmation')
  assert.equal(blockedLease.reserved, false)
  if (!blockedLease.reserved) assert.equal(blockedLease.reason, 'already_reserved')

  now = new Date(now.getTime() + 30_001)
  const reclaimedLease = await service.reserveAction(leaseToken, 'email_change_confirmation')
  assert(reclaimedLease.reserved)
  assert.equal(reclaimedLease.reclaimed, true)
  assert.equal(reclaimedLease.resultFingerprint, leaseMarker.resultFingerprint)
  assert.notEqual(reclaimedLease.reservationNonce, firstLease.reservationNonce)
  assert.deepEqual(
    await service.finalizeAction(
      leaseToken,
      'email_change_confirmation',
      firstLease.reservationNonce,
      'email:lease-result',
    ),
    { finalized: false, reason: 'invalid_reservation' },
  )
  assert.deepEqual(
    await service.releaseAction(
      leaseToken,
      'email_change_confirmation',
      firstLease.reservationNonce,
    ),
    { released: false },
  )
  assert.deepEqual(
    await service.releaseAction(
      leaseToken,
      'email_change_confirmation',
      reclaimedLease.reservationNonce,
    ),
    { released: true },
  )
  const afterRelease = await service.reserveAction(leaseToken, 'email_change_confirmation')
  assert(afterRelease.reserved)
  assert.equal(afterRelease.resultFingerprint, undefined)

  const invalidatedRecord = repository.records.find(
    (record) => record.tokenDigest === digestMemberAccountAction(leaseToken),
  )
  assert(invalidatedRecord)
  invalidatedRecord.invalidatedAt = now.toISOString()
  invalidatedRecord.reservationNonce = undefined
  invalidatedRecord.reservedAt = undefined
  invalidatedRecord.leaseExpiresAt = undefined
  assert.deepEqual(await service.reserveAction(leaseToken, 'email_change_confirmation'), {
    reserved: false,
    reason: 'invalid_or_expired',
  })
  assert.deepEqual(await service.reserveAction('short', 'member_invitation'), {
    reserved: false,
    reason: 'invalid_or_expired',
  })

  nextToken = 'expired-password-reset-token-value'
  now = new Date(now.getTime() + 1)
  await service.issueAction({
    memberId: '1',
    email: 'student@example.test',
    purpose: 'password_reset',
    templateKey: 'member-password-reset',
    actionPath: '/reset-password',
    ttlMs: 1,
  })
  now = new Date(now.getTime() + 2)
  assert.deepEqual(await service.reserveAction(nextToken, 'password_reset'), {
    reserved: false,
    reason: 'invalid_or_expired',
  })

  let resetNow = new Date('2026-07-02T02:00:00.000Z')
  const resetRepository = new MemoryActionRepository(() => new Date(resetNow))
  const resetTransport = new FakeTransport()
  let resetToken = 'first-password-reset-token-that-is-never-stored'
  const resetService = createMemberAccountActionService({
    repository: resetRepository,
    transport: resetTransport,
    publicBaseUrl: 'https://preview.jpvbootcamp.test',
    now: () => new Date(resetNow),
    randomToken: () => resetToken,
    sendCooldownMs: 60_000,
    maxSendAttempts: 1,
  })
  await resetService.issueAction({
    memberId: '2',
    email: 'student@example.test',
    purpose: 'password_reset',
    templateKey: 'member-password-reset',
    actionPath: '/reset-password',
    ttlMs: 60 * 60 * 1000,
  })
  resetNow = new Date(resetNow.getTime() + 60_001)
  resetToken = 'rotated-password-reset-token-that-is-never-stored'
  const rotatedReset = await resetService.issueAction({
    memberId: '2',
    email: 'student@example.test',
    purpose: 'password_reset',
    templateKey: 'member-password-reset',
    actionPath: '/reset-password',
    ttlMs: 60 * 60 * 1000,
  })
  assert.equal(rotatedReset.delivery, 'queued')
  assert.equal(resetTransport.sent.length, 2)
  assert.equal(
    resetRepository.records.filter((record) => record.purpose === 'password_reset' && !record.invalidatedAt).length,
    1,
  )
  assert.equal(
    JSON.stringify(resetRepository.records).includes('rotated-password-reset-token-that-is-never-stored'),
    false,
  )

  nextToken = 'email-change-token-value-that-is-never-stored'
  now = new Date(now.getTime() + 1)
  transport.fail = true
  const failed = await service.issueAction({
    memberId: '1',
    email: 'new@example.test',
    purpose: 'email_change_confirmation',
    templateKey: 'member-email-change-confirmation',
    actionPath: '/api/member-email-change/complete',
    ttlMs: 60_000,
  })
  assert.equal(failed.delivery, 'failed')
  assert.equal(repository.deliveries.at(-1)?.reason, 'transport_error')

  const schemaUrl = 'postgresql://redacted.invalid/app?schema=jpvbootcamp_staging'
  const migrationSql = buildMemberAccountActionPurposeUpSql(schemaUrl)
  for (const purpose of MEMBER_ACCOUNT_ACTION_PURPOSES) {
    assert.match(migrationSql, new RegExp(`ADD VALUE IF NOT EXISTS '${purpose}'`))
  }
  for (const event of MEMBER_ACCOUNT_SECURITY_EVENTS) {
    assert.match(migrationSql, new RegExp(`ADD VALUE IF NOT EXISTS '${event}'`))
  }
  assert.doesNotMatch(migrationSql, /^\s*(DELETE\s+FROM|TRUNCATE|UPDATE\s+".*payload_members")\b/im)
  assert.match(buildMemberAccountActionPurposeDownSql(), /intentionally retained/)

  const replaceSql = buildReplaceActiveMemberAccountActionSql('jpvbootcamp_staging')
  const reserveSql = buildReserveMemberAccountActionSql('jpvbootcamp_staging')
  const markMutationSql = buildMarkMemberAccountActionMutationStartedSql('jpvbootcamp_staging')
  const finalizeSql = buildFinalizeMemberAccountActionSql('jpvbootcamp_staging')
  const releaseSql = buildReleaseMemberAccountActionSql('jpvbootcamp_staging')
  const completedSql = buildFindCompletedMemberAccountActionSql('jpvbootcamp_staging')
  for (const sql of [replaceSql, reserveSql, markMutationSql, finalizeSql, releaseSql, completedSql]) {
    assert.match(sql, /"jpvbootcamp_staging"\."payload_member_verification_tokens"/)
    assert.doesNotMatch(sql, /SELECT \*/i)
    assert.doesNotMatch(sql, /member-invitation-token-value/)
  }
  assert.match(replaceSql, /ON CONFLICT \("member_id", "purpose"\)/)
  assert.match(replaceSql, /"lease_expires_at" <= now\(\)/)
  assert.match(replaceSql, /"result_fingerprint" IS NULL/)
  assert.match(reserveSql, /FOR UPDATE SKIP LOCKED/)
  assert.match(reserveSql, /"lease_expires_at" <= now\(\)/)
  assert.match(reserveSql, /\$4::bigint \* interval '1 millisecond'/)
  assert.match(markMutationSql, /"reservation_nonce" = \$3::varchar/)
  assert.match(markMutationSql, /"result_fingerprint" = \$4::varchar/)
  assert.match(markMutationSql, /"lease_expires_at" > now\(\)/)
  assert.match(markMutationSql, /"result_fingerprint" IS NULL OR "result_fingerprint" = \$4::varchar/)
  assert.match(finalizeSql, /"reservation_nonce" = \$3::varchar/)
  assert.match(finalizeSql, /"result_fingerprint" = \$4::varchar/)
  assert.match(finalizeSql, /"lease_expires_at" > now\(\)/)
  assert.match(releaseSql, /"reservation_nonce" = \$3::varchar/)
  assert.match(releaseSql, /"consumed_at" IS NULL/)
  assert.match(completedSql, /"token_digest" = \$1::varchar/)
  assert.match(completedSql, /"purpose" = \$2/)

  const reservationUpSql = buildMemberAccountActionReservationUpSql(schemaUrl)
  const reservationDownSql = buildMemberAccountActionReservationDownSql(schemaUrl)
  for (const column of ['reservation_nonce', 'reserved_at', 'lease_expires_at', 'result_fingerprint']) {
    assert.match(reservationUpSql, new RegExp(`ADD COLUMN IF NOT EXISTS "${column}"`))
    assert.match(reservationDownSql, new RegExp(`DROP COLUMN IF EXISTS "${column}"`))
  }
  assert.match(reservationUpSql, /reservation_state_check/)
  assert.match(reservationUpSql, /result_state_check/)
  assert.match(reservationUpSql, /WHERE "consumed_at" IS NULL/)
  assert.doesNotMatch(reservationUpSql, /raw_token|token_value|password/i)
  assert.doesNotMatch(reservationUpSql, /UPDATE\s+".*payload_member_verification_tokens"/i)
  for (const preserved of ['consumed_at', 'invalidated_at', 'expires_at', 'token_digest', 'purpose', 'member_id']) {
    assert.doesNotMatch(reservationDownSql, new RegExp(`DROP COLUMN IF EXISTS "${preserved}"`))
  }

  const purposeField = PayloadMemberVerificationRecords.fields.find(
    (field) => 'name' in field && field.name === 'purpose',
  )
  assert(purposeField && 'options' in purposeField && Array.isArray(purposeField.options))
  const optionValues = new Set(
    purposeField.options.map((option) => typeof option === 'string' ? option : option.value),
  )
  for (const purpose of MEMBER_ACCOUNT_ACTION_PURPOSES) assert(optionValues.has(purpose))

  assert(
    PAYLOAD_MIGRATION_NAMES.indexOf('20260702_001500_member_account_action_purposes') >
      PAYLOAD_MIGRATION_NAMES.indexOf('20260701_201500_member_email_verification'),
  )

  const emailPayload = new FakePayload()
  const accountActionTransport = createQueuedMemberAccountActionTransport(emailPayload as never)
  const queued = await accountActionTransport.send({
    to: 'student@example.test',
    templateKey: 'member-password-reset',
    actionUrl: 'https://preview.jpvbootcamp.test/reset-password?token=token-value-that-is-long-enough',
    displayName: 'Student',
    memberId: '42',
    purpose: 'password_reset',
    idempotencyKey: 'dedupe-key',
    attempt: 1,
  })
  assert.equal(queued.providerMessageId, 'email_1')
  assert.equal(emailPayload.events.length, 1)
  assert.equal(emailPayload.events[0]?.dedupe_key, 'member-password-reset:42:dedupe-key')
  assert.equal(emailPayload.queries.some((query) => /ON CONFLICT/i.test(query)), false)

  const deduped = await accountActionTransport.send({
    to: 'student@example.test',
    templateKey: 'member-password-reset',
    actionUrl: 'https://preview.jpvbootcamp.test/reset-password?token=token-value-that-is-long-enough',
    displayName: 'Student',
    memberId: '42',
    purpose: 'password_reset',
    idempotencyKey: 'dedupe-key',
    attempt: 2,
  })
  assert.equal(deduped.providerMessageId, 'email_1')
  assert.equal(emailPayload.events.length, 1)

  console.log('member account action checks passed')
}

void run()
