import assert from 'node:assert/strict'

import {
  COMMUNICATION_REGISTRY,
  getRequiredCommunicationKeys,
  isRequiredCommunicationKey,
} from '../src/lib/communications/registry'
import {
  buildDefaultMemberCommunicationPreferences,
  sanitizeMemberCommunicationPreferences,
} from '../src/lib/communications/preferences'
import {
  signUnsubscribeToken,
  validateUnsubscribeToken,
} from '../src/lib/communications/unsubscribe'

assert.ok(COMMUNICATION_REGISTRY.length >= 10)
assert.deepEqual(getRequiredCommunicationKeys().sort(), [...getRequiredCommunicationKeys()].sort())
assert.equal(isRequiredCommunicationKey('member-email-verification'), true)
assert.equal(isRequiredCommunicationKey('community-reply'), false)

for (const entry of COMMUNICATION_REGISTRY) {
  assert.ok(entry.key)
  assert.ok(entry.description)
  assert.ok(entry.category)
  assert.ok(entry.dedupeStrategy)
  assert.ok(entry.retryPolicy)
  assert.ok(entry.auditEvent)
  assert.ok(entry.channels.length > 0)
  assert.ok(Array.isArray(entry.channels))
  if (entry.required) {
    assert.equal(entry.unsubscribeAllowed, false)
  }
}

const defaults = buildDefaultMemberCommunicationPreferences()
assert.equal(defaults.communityReplies, true)
assert.equal(defaults.communityDigest, false)

const sanitized = sanitizeMemberCommunicationPreferences({
  communityReplies: false,
  broadcasts: true,
})
assert.equal(sanitized.communityReplies, false)
assert.equal(sanitized.broadcasts, true)

const secret = 'test-secret'
const token = signUnsubscribeToken(
  {
    v: 1,
    purpose: 'communication_unsubscribe',
    preferenceKey: 'communityReplies',
    memberDigest: 'digest',
    expiresAt: '2027-07-08T01:00:00.000Z',
    nonce: 'nonce',
  },
  secret,
)

assert.equal(validateUnsubscribeToken(token, secret, 'communityReplies').ok, true)
assert.equal(validateUnsubscribeToken(token, secret, 'broadcasts').ok, false)
assert.equal(validateUnsubscribeToken(`${token}x`, secret, 'communityReplies').ok, false)
assert.equal(
  validateUnsubscribeToken(
    signUnsubscribeToken(
      {
        v: 1,
        purpose: 'communication_unsubscribe',
        preferenceKey: 'communityReplies',
        memberDigest: 'digest',
        expiresAt: '2020-07-03T01:00:00.000Z',
        nonce: 'nonce',
      },
      secret,
    ),
    secret,
    'communityReplies',
  ).ok,
  false,
)

const redacted = JSON.stringify({ defaults, sanitized, token })
for (const forbidden of ['@', 'cookie', 'token=', 'postgres://']) {
  assert.equal(redacted.includes(forbidden), false)
}

console.log('payload_communications_registry.test.ts passed')
