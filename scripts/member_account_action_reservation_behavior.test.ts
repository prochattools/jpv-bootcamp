import assert from 'node:assert/strict'

import {
  createMemberAccountActionService,
  type MemberAccountActionPurpose,
  type MemberAccountActionService,
} from '../src/lib/auth/memberAccountActions'
import { completeMemberSetup } from '../src/lib/members/completeMemberSetup'
import { completePasswordReset } from '../src/lib/members/completePasswordReset'
import { completeMemberEmailChange } from '../src/lib/members/changeMemberEmail'
import { MemoryMemberAccountActionRepository } from './helpers/memberAccountActionMemoryRepository'

process.env.DATABASE_URL ??= 'postgresql://redacted.invalid/app?schema=jpvbootcamp_staging'

type Clock = {
  now: Date
}

function actionValue(label: string): string {
  return `${label}-${'v'.repeat(48)}`
}

function passphraseValue(): string {
  return ['synthetic', 'member', 'phrase', 'value'].join('-')
}

function createActions(input: {
  purpose: MemberAccountActionPurpose
  token: string
  memberId?: string
  email?: string
  clock?: Clock
  leaseMs?: number
}) {
  const clock = input.clock ?? { now: new Date('2026-08-04T09:00:00.000Z') }
  const repository = new MemoryMemberAccountActionRepository(() => new Date(clock.now))
  let nonce = 0
  const service = createMemberAccountActionService({
    repository,
    transport: {
      async send() {
        return { providerMessageId: 'synthetic-message' }
      },
    },
    publicBaseUrl: 'https://preview.jpvbootcamp.test',
    now: () => new Date(clock.now),
    randomToken: () => input.token,
    randomReservationNonce: () => `reservation-nonce-${++nonce}`,
    reservationLeaseMs: input.leaseMs ?? 5_000,
    sendCooldownMs: 1,
    maxSendAttempts: 5,
  })

  return {
    clock,
    repository,
    service,
    async issue() {
      await service.issueAction({
        memberId: input.memberId ?? 'member_1',
        email: input.email ?? 'member@example.test',
        purpose: input.purpose,
        templateKey: 'synthetic-template',
        actionPath: '/synthetic-action',
        ttlMs: 60 * 60 * 1000,
      })
    },
  }
}

async function testCoreStateMachine(): Promise<void> {
  const token = actionValue('primary-action')
  const fixture = createActions({ purpose: 'member_invitation', token })
  await fixture.issue()
  assert.equal(fixture.repository.records.length, 1)
  assert.equal(fixture.repository.records[0]?.purpose, 'member_invitation')
  assert.ok(new Date(fixture.repository.records[0]?.expiresAt ?? 0).getTime() > fixture.clock.now.getTime())

  const first = await fixture.service.reserveAction(token, 'member_invitation')
  assert.equal(first.reserved, true, JSON.stringify(first))
  const blocked = await fixture.service.reserveAction(token, 'member_invitation')
  assert.equal(blocked.reserved, false)
  if (blocked.reserved === false) assert.equal(blocked.reason, 'already_reserved')

  assert.deepEqual(
    await fixture.service.releaseAction(token, 'member_invitation', 'stale-nonce'),
    { released: false },
  )
  assert.deepEqual(
    await fixture.service.finalizeAction(
      token,
      'member_invitation',
      'stale-nonce',
      'member-active',
    ),
    { finalized: false, reason: 'invalid_reservation' },
  )

  assert(first.reserved)
  assert.deepEqual(
    await fixture.service.releaseAction(token, 'member_invitation', first.reservationNonce),
    { released: true },
  )
  const afterRelease = await fixture.service.reserveAction(token, 'member_invitation')
  assert.equal(afterRelease.reserved, true)
  assert(afterRelease.reserved)

  const completed = await fixture.service.finalizeAction(
    token,
    'member_invitation',
    afterRelease.reservationNonce,
    'member-active',
  )
  assert.equal(completed.finalized, true)
  const replay = await fixture.service.finalizeAction(
    token,
    'member_invitation',
    afterRelease.reservationNonce,
    'member-active',
  )
  assert.equal(replay.finalized, true)
  if (replay.finalized) assert.equal(replay.replayed, true)
  assert.deepEqual(
    await fixture.service.finalizeAction(
      token,
      'member_invitation',
      afterRelease.reservationNonce,
      'different-result',
    ),
    { finalized: false, reason: 'result_conflict' },
  )
  const consumedReservation = await fixture.service.reserveAction(token, 'member_invitation')
  assert.equal(consumedReservation.reserved, false)
  if (consumedReservation.reserved === false) assert.equal(consumedReservation.reason, 'already_consumed')

  const serialized = JSON.stringify(fixture.repository.records)
  assert.equal(serialized.includes(token), false)
  const resultFingerprint = fixture.repository.records[0]?.resultFingerprint ?? ''
  assert.equal(resultFingerprint.includes('member@example.test'), false)
}

async function testLeaseReclaimAndPurposeIsolation(): Promise<void> {
  const token = actionValue('primary-action')
  const fixture = createActions({ purpose: 'password_reset', token, leaseMs: 1_000 })
  await fixture.issue()

  const first = await fixture.service.reserveAction(token, 'password_reset')
  assert(first.reserved)
  fixture.clock.now = new Date(fixture.clock.now.getTime() + 1_001)
  const reclaimed = await fixture.service.reserveAction(token, 'password_reset')
  assert(reclaimed.reserved)
  assert.equal(reclaimed.reclaimed, true)

  assert.deepEqual(
    await fixture.service.finalizeAction(
      token,
      'password_reset',
      first.reservationNonce,
      'password-reset-completed',
    ),
    { finalized: false, reason: 'invalid_reservation' },
  )
  assert.equal(
    (await fixture.service.reserveAction(token, 'member_invitation')).reserved,
    false,
  )

  const record = fixture.repository.records[0]
  assert(record)
  record.invalidatedAt = fixture.clock.now.toISOString()
  assert.equal((await fixture.service.reserveAction(token, 'password_reset')).reserved, false)

  const expiredFixture = createActions({
    purpose: 'email_change_confirmation',
    token: 'expired-email-change-token-value',
  })
  await expiredFixture.issue()
  expiredFixture.clock.now = new Date(expiredFixture.clock.now.getTime() + 2 * 60 * 60 * 1000)
  assert.equal(
    (await expiredFixture.service.reserveAction(
      'expired-email-change-token-value',
      'email_change_confirmation',
    )).reserved,
    false,
  )
  assert.equal(
    (await expiredFixture.service.reserveAction('short', 'password_reset')).reserved,
    false,
  )
}

async function testMarkedActionCannotBeReissued(): Promise<void> {
  const token = actionValue('marked-action')
  const fixture = createActions({
    purpose: 'email_change_confirmation',
    token,
    leaseMs: 1_000,
  })
  await fixture.issue()

  const reserved = await fixture.service.reserveAction(token, 'email_change_confirmation')
  assert(reserved.reserved)
  const marked = await fixture.service.markMutationStarted(
    token,
    'email_change_confirmation',
    reserved.reservationNonce,
    'email:synthetic-result',
  )
  assert.equal(marked.marked, true)
  assert.ok(marked.resultFingerprint)

  const before = structuredClone(fixture.repository.records[0])
  fixture.clock.now = new Date(fixture.clock.now.getTime() + 1_001)
  const reissue = await fixture.service.issueAction({
    memberId: 'member_1',
    email: 'member@example.test',
    purpose: 'email_change_confirmation',
    templateKey: 'synthetic-template',
    actionPath: '/synthetic-action',
    ttlMs: 60 * 60 * 1000,
  })
  assert.deepEqual(reissue, { accepted: true, delivery: 'suppressed' })
  assert.equal(fixture.repository.records.length, 1)
  assert.equal(fixture.repository.records[0]?.tokenDigest, before?.tokenDigest)
  assert.equal(fixture.repository.records[0]?.resultFingerprint, before?.resultFingerprint)
  assert.equal(fixture.repository.records[0]?.idempotencyKey, before?.idempotencyKey)

  const reclaimed = await fixture.service.reserveAction(token, 'email_change_confirmation')
  assert(reclaimed.reserved)
  assert.equal(reclaimed.reclaimed, true)
  assert.equal(reclaimed.resultFingerprint, before?.resultFingerprint)
}

function createInvitationPayload() {
  const member: Record<string, unknown> = {
    id: 'member_1',
    email: 'member@example.test',
    accountStatus: 'pending',
  }
  let updateCalls = 0
  const payload = {
    async findByID() {
      return member
    },
    async update(input: { data: Record<string, unknown> }) {
      updateCalls += 1
      Object.assign(member, input.data)
      return member
    },
    async create() {
      throw new Error('synthetic post-finalization side-effect failure')
    },
  }
  return { payload, member, getUpdateCalls: () => updateCalls }
}

async function testInvitationConcurrencyAndSafeRetry(): Promise<void> {
  const token = actionValue('primary-action')
  const fixture = createActions({ purpose: 'member_invitation', token })
  await fixture.issue()
  const invitation = createInvitationPayload()

  const input = {
    token,
    password: 'synthetic-password-value',
    passwordConfirmation: 'synthetic-password-value',
  }
  const results = await Promise.all([
    completeMemberSetup(invitation.payload as never, fixture.service, input),
    completeMemberSetup(invitation.payload as never, fixture.service, input),
  ])
  assert.equal(results.filter((result) => result.ok).length, 1)
  assert.equal(invitation.getUpdateCalls(), 1)
  assert.equal(invitation.member.accountStatus, 'active')

  const failureToken = actionValue('retry-action')
  const retryFixture = createActions({ purpose: 'member_invitation', token: failureToken })
  await retryFixture.issue()
  let failLoad = true
  const retryPayload = createInvitationPayload()
  const originalFind = retryPayload.payload.findByID
  retryPayload.payload.findByID = async () => {
    if (failLoad) throw new Error('synthetic safe pre-mutation failure')
    return originalFind()
  }
  const failed = await completeMemberSetup(retryPayload.payload as never, retryFixture.service, {
    ...input,
    token: failureToken,
  })
  assert.equal(failed.ok, false)
  assert.equal(retryFixture.repository.records[0]?.reservationNonce, undefined)
  failLoad = false
  const retried = await completeMemberSetup(retryPayload.payload as never, retryFixture.service, {
    ...input,
    token: failureToken,
  })
  assert.equal(retried.ok, true)
}

function createPasswordResetPayload() {
  const member: Record<string, unknown> = {
    id: 'member_1',
    email: 'member@example.test',
    accountStatus: 'active',
    emailVerifiedAt: '2026-08-04T08:00:00.000Z',
    lockUntil: null,
  }
  let preparedToken: string | null = null
  let resetCalls = 0
  const payload = {
    db: {
      async updateOne(input: { data: { resetPasswordToken?: string } }) {
        preparedToken = input.data.resetPasswordToken ?? null
      },
      pool: {
        async query(sql: string) {
          if (sql.includes('reset_password_token')) {
            return { rows: [{ reset_password_token: preparedToken }] }
          }
          return { rows: [] }
        },
      },
    },
    async findByID() {
      return member
    },
    async resetPassword() {
      resetCalls += 1
      preparedToken = null
      return { user: member }
    },
    async update(input: { data: Record<string, unknown> }) {
      Object.assign(member, input.data)
      return member
    },
    async create() {
      throw new Error('synthetic post-finalization side-effect failure')
    },
  }
  return { payload, getResetCalls: () => resetCalls }
}

async function testPasswordResetConcurrencyAndSafeRetry(): Promise<void> {
  const token = actionValue('primary-action')
  const fixture = createActions({ purpose: 'password_reset', token })
  await fixture.issue()
  const reset = createPasswordResetPayload()
  const input = {
    token,
    password: 'synthetic-password-value',
    passwordConfirmation: 'synthetic-password-value',
  }
  const results = await Promise.all([
    completePasswordReset(reset.payload as never, fixture.service, input),
    completePasswordReset(reset.payload as never, fixture.service, input),
  ])
  assert.equal(
    results.filter((result) => result.ok).length,
    1,
    JSON.stringify(results),
  )
  assert.equal(reset.getResetCalls(), 1, JSON.stringify(results))
  const serialized = JSON.stringify(fixture.repository.records)
  assert.equal(serialized.includes(input.password), false)

  const failureToken = actionValue('retry-action')
  const retryFixture = createActions({ purpose: 'password_reset', token: failureToken })
  await retryFixture.issue()
  const retry = createPasswordResetPayload()
  let failPrepare = true
  const originalUpdateOne = retry.payload.db.updateOne
  retry.payload.db.updateOne = async (input) => {
    if (failPrepare) throw new Error('synthetic safe prepare failure')
    await originalUpdateOne(input)
  }
  const failed = await completePasswordReset(retry.payload as never, retryFixture.service, {
    ...input,
    token: failureToken,
  })
  assert.equal(failed.ok, false)
  assert.equal(
    retryFixture.repository.records[0]?.reservationNonce,
    undefined,
    JSON.stringify({
      result: failed,
      hasReservation: Boolean(retryFixture.repository.records[0]?.reservationNonce),
      hasFingerprint: Boolean(retryFixture.repository.records[0]?.resultFingerprint),
    }),
  )
  failPrepare = false
  const retried = await completePasswordReset(retry.payload as never, retryFixture.service, {
    ...input,
    token: failureToken,
  })
  assert.equal(retried.ok, true)
}

function createEmailChangePayload(targetEmail: string) {
  const members: Array<Record<string, unknown>> = [
    {
      id: 'member_1',
      email: 'old@example.test',
      accountStatus: 'active',
      emailVerifiedAt: '2026-08-04T08:00:00.000Z',
    },
  ]
  let updateCalls = 0
  const payload = {
    async findByID() {
      return members[0]
    },
    async find(input: { where?: { email?: { equals?: string } } }) {
      const email = input.where?.email?.equals
      return { docs: members.filter((member) => member.email === email) }
    },
    async update(input: { data: Record<string, unknown> }) {
      updateCalls += 1
      Object.assign(members[0], input.data)
      return members[0]
    },
    async create() {
      throw new Error('synthetic post-finalization side-effect failure')
    },
  }
  return { payload, members, getUpdateCalls: () => updateCalls, targetEmail }
}

async function testEmailChangeConcurrencyAndSafeRetry(): Promise<void> {
  const token = actionValue('primary-action')
  const targetEmail = 'new@example.test'
  const fixture = createActions({
    purpose: 'email_change_confirmation',
    token,
    email: targetEmail,
  })
  await fixture.issue()
  const emailChange = createEmailChangePayload(targetEmail)
  const results = await Promise.all([
    completeMemberEmailChange(
      emailChange.payload as never,
      fixture.service,
      token,
      'https://preview.jpvbootcamp.test',
    ),
    completeMemberEmailChange(
      emailChange.payload as never,
      fixture.service,
      token,
      'https://preview.jpvbootcamp.test',
    ),
  ])
  assert.equal(results.filter((result) => result.ok).length, 1)
  assert.equal(emailChange.getUpdateCalls(), 1)
  assert.equal(emailChange.members[0]?.email, targetEmail)
  const serialized = JSON.stringify(fixture.repository.records)
  assert.equal(serialized.includes(token), false)
  assert.equal(serialized.includes(targetEmail), true)
  const fingerprint = fixture.repository.records[0]?.resultFingerprint ?? ''
  assert.equal(fingerprint.includes(targetEmail), false)

  const duplicateToken = actionValue('duplicate-action')
  const duplicateFixture = createActions({
    purpose: 'email_change_confirmation',
    token: duplicateToken,
    email: 'duplicate@example.test',
  })
  await duplicateFixture.issue()
  const duplicatePayload = createEmailChangePayload('duplicate@example.test')
  duplicatePayload.members.push({ id: 'member_2', email: 'duplicate@example.test', accountStatus: 'active' })
  const duplicate = await completeMemberEmailChange(
    duplicatePayload.payload as never,
    duplicateFixture.service,
    duplicateToken,
    'https://preview.jpvbootcamp.test',
  )
  assert.deepEqual(duplicate, { ok: false, error: 'email_unavailable' })
  assert.equal(duplicateFixture.repository.records[0]?.reservationNonce, undefined)
  duplicatePayload.members.pop()
  const retried = await completeMemberEmailChange(
    duplicatePayload.payload as never,
    duplicateFixture.service,
    duplicateToken,
    'https://preview.jpvbootcamp.test',
  )
  assert.equal(retried.ok, true)
}

async function main(): Promise<void> {
  await testCoreStateMachine()
  await testLeaseReclaimAndPurposeIsolation()
  await testMarkedActionCannotBeReissued()
  await testInvitationConcurrencyAndSafeRetry()
  await testPasswordResetConcurrencyAndSafeRetry()
  await testEmailChangeConcurrencyAndSafeRetry()
  console.log('member_account_action_reservation_behavior.test.ts passed')
}

void main()
