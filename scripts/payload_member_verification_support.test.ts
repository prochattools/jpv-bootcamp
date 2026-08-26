import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { VERIFICATION_CONFIGURATION_CHECKLIST, getVerificationConfigurationNames } from '../src/lib/auth/memberVerificationReadiness'
import { summarizeVerificationSupportStatus } from '../src/lib/members/verificationSupport'

const names = getVerificationConfigurationNames()
assert.ok(names.includes('RESEND_API_KEY'))
assert.ok(names.includes('PAYLOAD_SECRET'))
assert.ok(names.includes('APP_PUBLIC_URL'))
assert.equal(new Set(names).size, names.length)

for (const item of VERIFICATION_CONFIGURATION_CHECKLIST) {
  assert.ok(item.category)
  assert.ok(item.names.length > 0)
}

const support = summarizeVerificationSupportStatus({
  member: { id: 'member_1', email: 'member@example.test', accountStatus: 'pending', emailVerifiedAt: null },
  activeToken: {
    id: 'token_1',
    createdAt: '2026-07-03T00:00:00.000Z',
    expiresAt: '2026-07-03T01:00:00.000Z',
    lastSentAt: '2026-07-03T00:00:00.000Z',
  },
  now: new Date('2026-07-03T00:01:00.000Z'),
} as never)

assert.equal(support.activeVerification, true)
assert.equal(support.cooldownActive, true)
assert.equal(support.email, 'member@example.test')

const payloadConfig = readFileSync('src/collections/affiliates/Affiliates.ts', 'utf8')
assert.match(payloadConfig, /Internal referral programme records/)

const partnersConfig = readFileSync('src/collections/partners/Partners.ts', 'utf8')
assert.match(partnersConfig, /External partner organizations and destinations/)

const billingConfig = readFileSync('src/collections/billing/Billing.ts', 'utf8')
assert.match(billingConfig, /Billing account projections/)

const accessConfig = readFileSync('src/collections/access/AccessControl.ts', 'utf8')
assert.match(accessConfig, /Member access groups used by course, community, and billing rules/)

const courseConfig = readFileSync('src/collections/courses/CourseRuntime.ts', 'utf8')
assert.match(courseConfig, /Protected media used for course resources|Private media used for protected lesson resources/)

const communityConfig = readFileSync('src/collections/community/Community.ts', 'utf8')
assert.match(communityConfig, /Community spaces and their visibility rules/)

const serialized = JSON.stringify({ names, support })
for (const forbidden of ['token=', 'password=', 'postgres://', 'RESEND_API_KEY=', 'DATABASE_URL=']) {
  assert.equal(serialized.includes(forbidden), false, forbidden)
}

console.log('payload_member_verification_support.test.ts passed')

