import assert from 'node:assert/strict'

import {
  createMemberAccountActionService,
  type MemberAccountActionDelivery,
} from '../src/lib/auth/memberAccountActions'
import { MemoryMemberAccountActionRepository } from './helpers/memberAccountActionMemoryRepository'
import { completeMemberSetup } from '../src/lib/members/completeMemberSetup'
import { completePasswordReset } from '../src/lib/members/completePasswordReset'
import { inviteMember } from '../src/lib/members/inviteMember'
import { requestPasswordReset } from '../src/lib/members/requestPasswordReset'
import type {
  PayloadDocument,
  PayloadId,
  PayloadMemberAuthAPI,
} from '../src/lib/payloadCourse/accessService'

type CollectionMap = Record<string, PayloadDocument[]>

class FakePayload implements PayloadMemberAuthAPI {
  calls: string[] = []
  sequence = 0

  constructor(private readonly collections: CollectionMap) {}

  async find(args: { collection: string; where?: Record<string, unknown>; limit?: number }) {
    this.calls.push(`find:${args.collection}`)
    const docs = (this.collections[args.collection] ?? []).filter((document) => {
      if (!args.where) return true
      return Object.entries(args.where).every(([field, condition]) => {
        if (!condition || typeof condition !== 'object') return document[field] === condition
        const record = condition as { equals?: unknown }
        return String(document[field] ?? '') === String(record.equals ?? '')
      })
    })
    return { docs: docs.slice(0, args.limit ?? docs.length) }
  }

  async findByID(args: { collection: string; id: PayloadId }) {
    const document = (this.collections[args.collection] ?? []).find(
      (entry) => String(entry.id) === String(args.id),
    )
    if (!document) throw new Error(`missing ${args.collection}:${args.id}`)
    return document
  }

  async create(args: { collection: string; data: Record<string, unknown> }) {
    this.calls.push(`create:${args.collection}`)
    const data = { ...structuredClone(args.data) }
    if (args.collection === 'payload_members' && typeof data.password === 'string') {
      delete data.password
      data.passwordHash = 'payload-managed-hash'
    }
    const document: PayloadDocument = { id: ++this.sequence, ...data }
    this.collections[args.collection] = this.collections[args.collection] ?? []
    this.collections[args.collection].push(document)
    return document
  }

  async update(args: { collection: string; id: PayloadId; data: Record<string, unknown> }) {
    this.calls.push(`update:${args.collection}`)
    const documents = this.collections[args.collection] ?? []
    const document = documents.find((entry) => String(entry.id) === String(args.id))
    if (!document) throw new Error(`missing ${args.collection}:${args.id}`)
    const data = { ...structuredClone(args.data) }
    if (args.collection === 'payload_members' && typeof data.password === 'string') {
      delete data.password
      data.passwordHash = 'payload-managed-hash'
    }
    Object.assign(document, data)
    return document
  }

  async login() {
    return { user: { id: 1 } }
  }

  async forgotPassword() {
    this.calls.push('forbidden:forgotPassword')
    return 'legacy-token'
  }

  async resetPassword(args: { collection: string; data: { token: string; password: string }; overrideAccess?: boolean }) {
    this.calls.push(`resetPassword:${args.collection}`)
    const documents = this.collections[args.collection] ?? []
    const document = documents.find(
      (entry) => String(entry.resetPasswordToken ?? '') === String(args.data.token),
    )
    if (!document) throw new Error(`resetPassword: no member found with matching token`)
    document.passwordHash = 'payload-managed-hash'
    delete document.resetPasswordToken
    delete document.resetPasswordExpiration
    return { user: document }
  }

  db = {
    updateOne: async (args: { collection: string; id: unknown; data: Record<string, unknown> }) => {
      const documents = this.collections[args.collection] ?? []
      const document = documents.find((entry) => String(entry.id) === String(args.id))
      if (!document) throw new Error(`missing ${args.collection}:${args.id}`)
      Object.assign(document, args.data)
      return document
    },
  }

  docs(collection: string) {
    return this.collections[collection] ?? []
  }
}

class MemoryActions extends MemoryMemberAccountActionRepository {}

class FakeTransport {
  deliveries: MemberAccountActionDelivery[] = []
  async send(delivery: MemberAccountActionDelivery) {
    this.deliveries.push(structuredClone(delivery))
    return { providerMessageId: `fake-${this.deliveries.length}` }
  }
}

async function run() {
  const payload = new FakePayload({
    payload_members: [],
    payload_member_profiles: [],
    payload_member_security_events: [],
    payload_audit_events: [],
    payload_email_events: [],
  })
  const repository = new MemoryActions(() => new Date('2026-07-02T00:00:00.000Z'))
  const transport = new FakeTransport()
  let token = 'invitation-action-value-that-is-never-stored'
  const service = createMemberAccountActionService({
    repository,
    transport,
    publicBaseUrl: 'https://preview.jpvbootcamp.test',
    now: () => new Date('2026-07-02T00:00:00.000Z'),
    randomToken: () => token,
  })

  const invitation = await inviteMember(payload, service, {
    administratorId: 'admin-1',
    email: ' Student@Example.Test ',
    displayName: 'Student',
  })
  assert.equal(invitation.ok, true)
  if (!invitation.ok) throw new Error('invitation failed')
  assert.equal(invitation.created, true)
  assert.equal(invitation.emailQueued, true)
  assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'pending')
  assert.equal(payload.docs('payload_members')[0]?.password, undefined)
  assert.equal(payload.docs('payload_members')[0]?.passwordHash, 'payload-managed-hash')
  assert.equal(repository.records[0]?.purpose, 'member_invitation')
  assert.equal(JSON.stringify(repository.records).includes(token), false)
  assert.match(transport.deliveries[0]?.actionUrl ?? '', /set-password/)
  assert.equal(
    payload.docs('payload_member_security_events').at(-1)?.eventType,
    'invitation_created',
  )

  const setup = await completeMemberSetup(payload, service, {
    token,
    password: 'strong-password-value',
    passwordConfirmation: 'strong-password-value',
  })
  assert.deepEqual(setup, { ok: true, activated: true })
  assert.equal(payload.docs('payload_members')[0]?.accountStatus, 'active')
  assert.equal(payload.docs('payload_members')[0]?.passwordHash, 'payload-managed-hash')
  // emailVerifiedAt must be set so the member can log in immediately
  assert.ok(
    payload.docs('payload_members')[0]?.emailVerifiedAt,
    'emailVerifiedAt must be set after invitation setup',
  )
  assert.equal(
    payload.docs('payload_member_security_events').some(
      (event) => event.eventType === 'invitation_consumed',
    ),
    true,
  )
  assert.equal(
    payload.docs('payload_email_events').at(-1)?.templateKey,
    'member-account-ready',
  )

  // Idempotent retry: resubmitting the same token against an already-active
  // member returns ok:true with activated:false instead of an error.
  const idempotentRetry = await completeMemberSetup(payload, service, {
    token,
    password: 'another-strong-password',
    passwordConfirmation: 'another-strong-password',
  })
  assert.deepEqual(idempotentRetry, { ok: true, activated: false })

  // A completely unknown/new token (the token was already consumed) returns an
  // error so a different token can't be replayed against an active account.
  const differentToken = 'different-token-value-that-is-long-enough'
  const reused = await completeMemberSetup(payload, service, {
    token: differentToken,
    password: 'another-strong-password',
    passwordConfirmation: 'another-strong-password',
  })
  assert.equal(reused.ok, false)

  const concurrentPayload = new FakePayload({
    payload_members: [],
    payload_member_profiles: [],
    payload_member_security_events: [],
    payload_audit_events: [],
    payload_email_events: [],
  })
  const concurrentRepository = new MemoryActions(() => new Date('2026-07-02T00:30:00.000Z'))
  const concurrentTransport = new FakeTransport()
  const concurrentToken = 'concurrent-invitation-action-value'
  const concurrentService = createMemberAccountActionService({
    repository: concurrentRepository,
    transport: concurrentTransport,
    publicBaseUrl: 'https://preview.jpvbootcamp.test',
    now: () => new Date('2026-07-02T00:30:00.000Z'),
    randomToken: () => concurrentToken,
  })
  const concurrentInvitation = await inviteMember(concurrentPayload, concurrentService, {
    administratorId: 'admin-1',
    email: 'concurrent@example.test',
    displayName: 'Concurrent Student',
  })
  assert.equal(concurrentInvitation.ok, true)
  const concurrentResults = await Promise.all([
    completeMemberSetup(concurrentPayload, concurrentService, {
      token: concurrentToken,
      password: 'strong-password-value',
      passwordConfirmation: 'strong-password-value',
    }),
    completeMemberSetup(concurrentPayload, concurrentService, {
      token: concurrentToken,
      password: 'strong-password-value',
      passwordConfirmation: 'strong-password-value',
    }),
  ])
  assert.equal(concurrentResults.filter((result) => result.ok && result.activated).length, 1)
  assert.equal(
    concurrentPayload.calls.filter((call) => call === 'update:payload_members').length,
    1,
  )
  assert.equal(JSON.stringify(concurrentRepository.records).includes(concurrentToken), false)

  const unknownReset = await requestPasswordReset(payload, service, {
    email: 'unknown@example.test',
  })
  token = 'password-reset-action-value-that-is-never-stored'
  const knownReset = await requestPasswordReset(payload, service, {
    email: 'student@example.test',
  })
  assert.deepEqual(knownReset, unknownReset)

  const resetIssue = await requestPasswordReset(payload, service, {
    email: 'student@example.test',
  })
  assert.deepEqual(resetIssue, knownReset)
  assert.equal(repository.records.at(-1)?.purpose, 'password_reset')

  const reset = await completePasswordReset(payload, service, {
    token,
    password: 'replacement-password-value',
    passwordConfirmation: 'replacement-password-value',
  })
  assert.equal(reset.ok, true)
  assert.equal(
    payload.docs('payload_email_events').some(
      (event) => event.templateKey === 'member-password-changed',
    ),
    true,
  )
  assert.equal(payload.calls.includes('forbidden:forgotPassword'), false)
  assert.equal(payload.calls.includes('forbidden:resetPassword'), false)

  const verifiedSignupPayload = new FakePayload({
    payload_members: [
      {
        id: 2,
        email: 'verified@example.test',
        accountStatus: 'pending',
        source: 'self_signup',
        emailVerifiedAt: '2026-07-02T00:00:00.000Z',
        password: 'existing-password',
      },
    ],
    payload_member_profiles: [{ id: 2, member: 2, displayName: 'Verified Student' }],
    payload_member_security_events: [],
    payload_audit_events: [],
    payload_email_events: [],
  })
  let resetToken = 'verified-self-signup-password-reset-value'
  const verifiedSignupTransport = new FakeTransport()
  const verifiedSignupService = createMemberAccountActionService({
    repository: new MemoryActions(() => new Date('2026-07-02T01:00:00.000Z')),
    transport: verifiedSignupTransport,
    publicBaseUrl: 'https://preview.jpvbootcamp.test',
    now: () => new Date('2026-07-02T01:00:00.000Z'),
    randomToken: () => resetToken,
  })
  const verifiedSignupReset = await requestPasswordReset(verifiedSignupPayload, verifiedSignupService, {
    email: 'verified@example.test',
  })
  assert.deepEqual(verifiedSignupReset, knownReset)
  assert.equal(verifiedSignupPayload.docs('payload_member_security_events').at(-1)?.eventType, 'password_reset_requested')
  assert.equal(
    verifiedSignupTransport.deliveries.some((delivery) => delivery.templateKey === 'member-password-reset'),
    true,
  )
  const verifiedSignupCompleted = await completePasswordReset(verifiedSignupPayload, verifiedSignupService, {
    token: resetToken,
    password: 'replacement-password-value',
    passwordConfirmation: 'replacement-password-value',
  })
  assert.equal(verifiedSignupCompleted.ok, true)
  assert.equal(verifiedSignupPayload.docs('payload_members')[0]?.accountStatus, 'pending')
  assert.equal(verifiedSignupPayload.docs('payload_email_events').some((event) => event.templateKey === 'member-password-changed'), true)

  const concurrentResetPayload = new FakePayload({
    payload_members: [{
      id: 3,
      email: 'reset-concurrent@example.test',
      accountStatus: 'active',
      source: 'self_signup',
      emailVerifiedAt: '2026-07-02T00:00:00.000Z',
    }],
    payload_member_profiles: [{ id: 3, member: 3, displayName: 'Reset Student' }],
    payload_member_security_events: [],
    payload_audit_events: [],
    payload_email_events: [],
  })
  const concurrentResetNow = () => new Date('2026-07-02T02:00:00.000Z')
  const concurrentResetRepository = new MemoryActions(concurrentResetNow)
  const concurrentResetToken = 'concurrent-password-reset-action-value'
  const concurrentResetService = createMemberAccountActionService({
    repository: concurrentResetRepository,
    transport: new FakeTransport(),
    publicBaseUrl: 'https://preview.jpvbootcamp.test',
    now: concurrentResetNow,
    randomToken: () => concurrentResetToken,
  })
  await requestPasswordReset(concurrentResetPayload, concurrentResetService, {
    email: 'reset-concurrent@example.test',
  })
  const concurrentResetResults = await Promise.all([
    completePasswordReset(concurrentResetPayload, concurrentResetService, {
      token: concurrentResetToken,
      password: 'replacement-password-value',
      passwordConfirmation: 'replacement-password-value',
    }),
    completePasswordReset(concurrentResetPayload, concurrentResetService, {
      token: concurrentResetToken,
      password: 'replacement-password-value',
      passwordConfirmation: 'replacement-password-value',
    }),
  ])
  assert.equal(concurrentResetResults.filter((result) => result.ok).length >= 1, true)
  assert.equal(
    concurrentResetPayload.calls.filter((call) => call === 'resetPassword:payload_members').length,
    1,
  )
  assert.equal(JSON.stringify(concurrentResetRepository.records).includes(concurrentResetToken), false)

  console.log('payload_member_invitation.test.ts passed')
}

void run()
