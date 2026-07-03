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
  assert.equal(result.status, 'queued')
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

  const loginPage = readFileSync('src/app/(frontend)/login/page.tsx', 'utf8')
  assert.match(loginPage, /Create free account/)
  assert.match(loginPage, /Resend verification/)

  const registerPage = readFileSync('src/app/(frontend)/register/page.tsx', 'utf8')
  assert.match(registerPage, /Create free account/)
  assert.match(registerPage, /Free is a real member tier/)

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
