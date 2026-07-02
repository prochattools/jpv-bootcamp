import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { PayloadMemberVerificationRecords } from '../src/collections/members/MemberEmailVerificationRecords'
import {
  createMemberAccountActionService,
  digestMemberAccountAction,
  type MemberAccountActionDelivery,
  type MemberAccountActionPurpose,
  type MemberAccountActionRecord,
  type MemberAccountActionRepository,
} from '../src/lib/auth/memberAccountActions'
import {
  MEMBER_ACCOUNT_ACTION_PURPOSES,
  MEMBER_ACCOUNT_SECURITY_EVENTS,
  buildMemberAccountActionPurposeDownSql,
  buildMemberAccountActionPurposeUpSql,
} from '../src/lib/auth/memberAccountActionMigrationSql'
import {
  buildConsumeMemberAccountActionSql,
  buildReplaceActiveMemberAccountActionSql,
} from '../src/lib/auth/memberAccountActionSql'

class MemoryActionRepository implements MemberAccountActionRepository {
  records: MemberAccountActionRecord[] = []
  deliveries: Array<{
    memberId: string
    purpose: MemberAccountActionPurpose
    idempotencyKey: string
    status: 'sent' | 'suppressed' | 'failed'
    attempt: number
    occurredAt: string
    reason?: 'cooldown' | 'max_attempts' | 'transport_error'
  }> = []

  async findActiveAction(memberId: string, purpose: MemberAccountActionPurpose) {
    return this.records.find(
      (record) =>
        record.memberId === memberId &&
        record.purpose === purpose &&
        !record.consumedAt &&
        !record.invalidatedAt,
    ) ?? null
  }

  async replaceActiveAction(record: MemberAccountActionRecord) {
    for (const current of this.records) {
      if (
        current.memberId === record.memberId &&
        current.purpose === record.purpose &&
        !current.consumedAt &&
        !current.invalidatedAt
      ) {
        current.invalidatedAt = record.createdAt
      }
    }
    this.records.push(structuredClone(record))
  }

  async findActionByDigest(tokenDigest: string, purpose: MemberAccountActionPurpose) {
    return this.records.find(
      (record) => record.tokenDigest === tokenDigest && record.purpose === purpose,
    ) ?? null
  }

  async consumeAction(
    tokenDigest: string,
    purpose: MemberAccountActionPurpose,
    consumedAt: string,
  ) {
    const record = this.records.find(
      (candidate) =>
        candidate.tokenDigest === tokenDigest &&
        candidate.purpose === purpose &&
        !candidate.consumedAt &&
        !candidate.invalidatedAt &&
        new Date(candidate.expiresAt).getTime() > new Date(consumedAt).getTime(),
    )
    if (!record) return null
    record.consumedAt = consumedAt
    return record.memberId
  }

  async recordDelivery(event: (typeof this.deliveries)[number]) {
    this.deliveries.push(structuredClone(event))
  }
}

class FakeTransport {
  sent: MemberAccountActionDelivery[] = []
  fail = false

  async send(delivery: MemberAccountActionDelivery) {
    this.sent.push(structuredClone(delivery))
    if (this.fail) throw new Error('fake transport failure')
    return { providerMessageId: `fake-${this.sent.length}` }
  }
}

async function run() {
  const repository = new MemoryActionRepository()
  const transport = new FakeTransport()
  let now = new Date('2026-07-02T00:00:00.000Z')
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

  const wrongPurpose = await service.completeAction(nextToken, 'password_reset')
  assert.deepEqual(wrongPurpose, { consumed: false, reason: 'invalid_or_expired' })

  const [winner, loser] = await Promise.all([
    service.completeAction(nextToken, 'member_invitation'),
    service.completeAction(nextToken, 'member_invitation'),
  ])
  assert.equal([winner, loser].filter((result) => result.consumed).length, 1)
  assert.equal(
    [winner, loser].filter(
      (result) => result.consumed === false && result.reason === 'already_used',
    ).length,
    1,
  )

  nextToken = 'password-reset-token-value-that-is-never-stored'
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
  assert.deepEqual(await service.completeAction(nextToken, 'password_reset'), {
    consumed: false,
    reason: 'invalid_or_expired',
  })

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
  const consumeSql = buildConsumeMemberAccountActionSql('jpvbootcamp_staging')
  assert.match(replaceSql, /"purpose" = \$3/)
  assert.match(replaceSql, /\$9::varchar/)
  assert.match(consumeSql, /"purpose" = \$2/)
  assert.match(consumeSql, /"consumed_at" IS NULL/)
  assert.match(consumeSql, /"invalidated_at" IS NULL/)
  assert.match(consumeSql, /"expires_at" > \$3::timestamptz/)
  assert.doesNotMatch(replaceSql, /member-invitation-token-value/)

  const purposeField = PayloadMemberVerificationRecords.fields.find(
    (field) => 'name' in field && field.name === 'purpose',
  )
  assert(purposeField && 'options' in purposeField && Array.isArray(purposeField.options))
  const optionValues = new Set(
    purposeField.options.map((option) => typeof option === 'string' ? option : option.value),
  )
  for (const purpose of MEMBER_ACCOUNT_ACTION_PURPOSES) assert(optionValues.has(purpose))

  const migrationIndex = readFileSync(new URL('../src/migrations/index.ts', import.meta.url), 'utf8')
  assert(
    migrationIndex.lastIndexOf("name: '20260702_001500_member_account_action_purposes'") >
      migrationIndex.lastIndexOf("name: '20260701_201500_member_email_verification'"),
  )

  console.log('member account action checks passed')
}

void run()
