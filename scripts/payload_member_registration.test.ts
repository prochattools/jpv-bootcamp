import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { registerFreeMember } from '../src/lib/members/registerFreeMember'
import { getVerificationConfigurationNames } from '../src/lib/auth/memberVerificationReadiness'
import { summarizeVerificationSupportStatus } from '../src/lib/members/verificationSupport'

type Doc = Record<string, unknown> & { id: string }

class FakePayload {
  private docs: Record<string, Doc[]>

  constructor(docs: Record<string, Doc[]>) {
    this.docs = docs
  }

  async find({ collection, where }: { collection: string; where?: Record<string, unknown> }) {
    const items = this.docs[collection] ?? []
    const email = where && 'email' in where ? (where.email as { equals?: string } | undefined)?.equals : undefined
    const member = where && 'member' in where ? (where.member as { equals?: string } | undefined)?.equals : undefined
    const filtered = items.filter((item) => {
      if (collection === 'payload_members' && email) return item.email === email
      if (collection === 'payload_member_profiles' && member) return item.member === member
      return true
    })
    return { docs: filtered }
  }

  async create({ collection, data }: { collection: string; data: Record<string, unknown> }) {
    const id = `${collection}_${(this.docs[collection] ?? []).length + 1}`
    const doc = { id, ...data } as Doc
    this.docs[collection] = [...(this.docs[collection] ?? []), doc]
    return doc
  }

  async update({ collection, id, data }: { collection: string; id: string; data: Record<string, unknown> }) {
    const items = this.docs[collection] ?? []
    const index = items.findIndex((item) => item.id === id)
    const updated = { ...items[index], ...data }
    items[index] = updated
    this.docs[collection] = items
    return updated
  }
}

async function main(): Promise<void> {
  const payload = new FakePayload({
    payload_members: [],
    payload_member_profiles: [],
    payload_member_security_events: [],
    payload_audit_events: [],
  })
  const verificationCalls: string[] = []

  const result = await registerFreeMember(
    payload as never,
    {
      async requestVerification(email: string) {
        verificationCalls.push(email)
        return { accepted: true, message: 'ok' }
      },
    },
    new Request('https://app.test/api/member-registration', {
      method: 'POST',
      headers: { origin: 'https://app.test' },
    }),
    {
      firstName: ' Ada ',
      lastName: ' Lovelace ',
      email: 'Ada@example.test',
      password: 'long-enough-password',
      passwordConfirmation: 'long-enough-password',
      acceptedTerms: true,
      termsVersion: '2026-07',
    },
    { now: new Date('2026-07-03T00:00:00.000Z') },
  )

  assert.equal(result.ok, true)
  assert.equal(result.status, 'created')
  assert.equal(result.message, 'Your free account has been created. Check your email to verify your address before signing in.')
  assert.equal(verificationCalls[0], 'ada@example.test')
  assert.equal(payload['docs'].payload_members[0]?.accountStatus, 'pending')
  assert.equal(payload['docs'].payload_member_profiles[0]?.displayName, 'Ada Lovelace')
  assert.equal(payload['docs'].payload_member_security_events[0]?.eventType, 'account_created')

  const duplicate = await registerFreeMember(
    payload as never,
    {
      async requestVerification() {
        throw new Error('should not be called for duplicates')
      },
    },
    new Request('https://app.test/api/member-registration', {
      method: 'POST',
      headers: { origin: 'https://app.test' },
    }),
    {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.test',
      password: 'long-enough-password',
      passwordConfirmation: 'long-enough-password',
      acceptedTerms: true,
      termsVersion: '2026-07',
    },
  )
  assert.equal(duplicate.ok, true)
  assert.equal(duplicate.status, 'duplicate')
  assert.equal(duplicate.message, 'An account already exists for this email. Sign in or resend verification.')

  const unavailable = await registerFreeMember(
    new FakePayload({
      payload_members: [],
      payload_member_profiles: [],
      payload_member_security_events: [],
      payload_audit_events: [],
    }) as never,
    {
      async requestVerification() {
        return { accepted: false, message: 'not configured' }
      },
    },
    new Request('https://app.test/api/member-registration', {
      method: 'POST',
      headers: { origin: 'https://app.test' },
    }),
    {
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.test',
      password: 'long-enough-password',
      passwordConfirmation: 'long-enough-password',
      acceptedTerms: true,
      termsVersion: '2026-07',
    },
  )
  assert.equal(unavailable.ok, true)
  assert.equal(unavailable.status, 'verification_unavailable')
  assert.equal(
    unavailable.message,
    'Your account was created, but verification email could not be sent from this environment. Contact support or try resend verification.',
  )

  for (const bad of [
    { acceptedTerms: false },
    { password: 'short', passwordConfirmation: 'short' },
    { passwordConfirmation: 'mismatch' },
    { email: 'not-an-email' },
  ]) {
    const output = await registerFreeMember(
      new FakePayload({ payload_members: [], payload_member_profiles: [], payload_member_security_events: [], payload_audit_events: [] }) as never,
      { async requestVerification() { return { accepted: true, message: 'ok' } } },
      new Request('https://app.test/api/member-registration', { method: 'POST', headers: { origin: 'https://app.test' } }),
      {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.test',
        password: 'long-enough-password',
        passwordConfirmation: 'long-enough-password',
        acceptedTerms: true,
        termsVersion: '2026-07',
        ...bad,
      } as never,
    )
    assert.equal(output.ok, false)
  }

  const support = summarizeVerificationSupportStatus({
    member: { id: 'member_1', email: 'member@example.test', accountStatus: 'pending', emailVerifiedAt: null },
    activeToken: { id: 'token_1', lastSentAt: '2026-07-03T00:00:00.000Z', expiresAt: '2026-07-03T01:00:00.000Z' },
    now: new Date('2026-07-03T00:02:00.000Z'),
  } as never)
  assert.equal(support.activeVerification, true)
  assert.equal(support.cooldownActive, true)

  const names = getVerificationConfigurationNames()
  assert.ok(names.includes('RESEND_API_KEY'))
  assert.ok(names.includes('APP_PUBLIC_URL'))
  assert.ok(names.includes('PAYLOAD_SECRET'))

  const portalPage = readFileSync('src/app/(frontend)/portal/page.tsx', 'utf8')
  assert.match(portalPage, /params\?\.mode\) === 'login'/)
  assert.match(portalPage, /Choose membership/)
  assert.match(portalPage, /redirect\('\/upgrade'\)/)
  assert.match(portalPage, /Forgot password/)
  assert.match(portalPage, /resend verification/i)
  assert.doesNotMatch(portalPage, /Create free account|New Free accounts/)

  const loginPage = readFileSync('src/app/(frontend)/login/page.tsx', 'utf8')
  assert.match(loginPage, /redirect\(`\/portal\?\$\{target\.toString\(\)\}`\)/)
  assert.doesNotMatch(loginPage, /MemberLoginForm/)

  const registerRoute = readFileSync('src/app/(frontend)/register/route.ts', 'utf8')
  assert.match(registerRoute, /410|Gone/)
  assert.match(registerRoute, /Registration is permanently disabled/)
  assert.match(registerRoute, /exclusive.*Checkout/)
  assert.doesNotMatch(registerRoute, /MemberRegistrationForm|Create free account/)

  const registrationRoute = readFileSync('src/app/api/member-registration/route.ts', 'utf8')
  assert.match(registrationRoute, /registration_disabled/)
  assert.match(registrationRoute, /status = 200|410/)
  assert.match(registrationRoute, /checkoutPath: '\/upgrade'/)
  assert.doesNotMatch(registrationRoute, /registerFreeMember|getPayloadMemberEmailVerificationService/)

  const serialized = JSON.stringify({ names, support, result })
  for (const forbidden of ['token=', 'password=', 'postgres://', 'cookie', '@example.com']) {
    assert.equal(serialized.includes(forbidden), false, forbidden)
  }

  console.log('payload_member_registration.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
