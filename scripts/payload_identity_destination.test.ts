import assert from 'node:assert/strict'

import { resolveIdentityDestination } from '../src/lib/auth/identityDestination'
import { mapPayloadAuthUser } from '../src/lib/auth/payloadSessionMapping'
import {
  decideSharedLogin,
  type SharedLoginSession,
} from '../src/lib/auth/sharedLoginDecision'
import { sanitizeInternalDestination } from '../src/lib/auth/safeRedirect'

const verifiedAt = '2026-01-01T00:00:00.000Z'

assert.deepEqual(resolveIdentityDestination({}), {
  kind: 'anonymous',
  allowed: false,
  destination: null,
  reason: 'no_authenticated_identity',
})

assert.deepEqual(resolveIdentityDestination({ administratorId: 'admin_1' }), {
  kind: 'administrator',
  allowed: true,
  destination: '/admin',
  reason: 'administrator_authenticated',
})

assert.deepEqual(
  resolveIdentityDestination({
    member: {
      id: 'member_1',
      accountStatus: 'active',
      emailVerifiedAt: verifiedAt,
    },
  }),
  {
    kind: 'member',
    allowed: true,
    destination: '/portal',
    reason: 'active_verified_member',
  },
)

for (const [status, expectedKind, expectedReason] of [
  ['blocked', 'blocked', 'member_blocked'],
  ['suspended', 'suspended', 'member_suspended'],
] as const) {
  assert.deepEqual(
    resolveIdentityDestination({
      member: {
        id: `member_${status}`,
        accountStatus: status,
        emailVerifiedAt: verifiedAt,
      },
    }),
    {
      kind: expectedKind,
      allowed: false,
      destination: null,
      reason: expectedReason,
    },
  )
}

assert.deepEqual(
  resolveIdentityDestination({
    member: {
      id: 'member_unverified',
      accountStatus: 'active',
      emailVerifiedAt: null,
    },
  }),
  {
    kind: 'unresolved',
    allowed: false,
    destination: null,
    reason: 'member_email_unverified',
  },
)

assert.deepEqual(
  resolveIdentityDestination({
    member: {
      id: 'member_unknown',
      accountStatus: 'legacy_unknown',
      emailVerifiedAt: verifiedAt,
    },
  }),
  {
    kind: 'unresolved',
    allowed: false,
    destination: null,
    reason: 'member_status_unknown',
  },
)

const dualRole: SharedLoginSession = {
  administratorId: 'admin_1',
  member: {
    id: 'member_1',
    accountStatus: 'active',
    emailVerifiedAt: verifiedAt,
  },
}

assert.deepEqual(resolveIdentityDestination(dualRole), {
  kind: 'dual_role',
  allowed: false,
  destination: null,
  reason: 'explicit_domain_required',
})

assert.equal(resolveIdentityDestination({ ...dualRole, requestedDomain: 'admin' }).destination, '/admin')
assert.equal(resolveIdentityDestination({ ...dualRole, requestedDomain: 'member' }).destination, '/portal')

assert.deepEqual(
  resolveIdentityDestination({ administratorId: 'admin_1', requestedDomain: 'member' }),
  {
    kind: 'unresolved',
    allowed: false,
    destination: null,
    reason: 'requested_domain_unavailable',
  },
)

assert.deepEqual(mapPayloadAuthUser(null), {
  administratorId: null,
  member: null,
  unresolvedCollection: false,
  authenticatedCollection: null,
})

assert.deepEqual(mapPayloadAuthUser({ collection: 'payload_users', id: 'admin_1' }), {
  administratorId: 'admin_1',
  member: null,
  unresolvedCollection: false,
  authenticatedCollection: 'payload_users',
})

assert.deepEqual(mapPayloadAuthUser({ collection: 'payload_members', id: 'member_1' }), {
  administratorId: null,
  member: {
    id: 'member_1',
    accountStatus: null,
    emailVerifiedAt: null,
  },
  unresolvedCollection: false,
  authenticatedCollection: 'payload_members',
})

assert.deepEqual(mapPayloadAuthUser({ collection: 'payload_users' }), {
  administratorId: null,
  member: null,
  unresolvedCollection: true,
  authenticatedCollection: 'payload_users',
})

assert.deepEqual(mapPayloadAuthUser({ collection: 'unexpected_users', id: 'unexpected_1' }), {
  administratorId: null,
  member: null,
  unresolvedCollection: true,
  authenticatedCollection: 'unexpected_users',
})

assert.deepEqual(decideSharedLogin({ administratorId: null, member: null }), {
  allowed: false,
  destination: null,
  identity: {
    kind: 'anonymous',
    allowed: false,
    destination: null,
    reason: 'no_authenticated_identity',
  },
  reason: 'no_authenticated_identity',
})

assert.equal(decideSharedLogin({ administratorId: 'admin_1', member: null }).destination, '/admin')
assert.equal(
  decideSharedLogin({ administratorId: 'admin_1', member: null }, '/admin/collections/payload_users').destination,
  '/admin/collections/payload_users',
)

const activeMemberSession: SharedLoginSession = {
  administratorId: null,
  member: {
    id: 'member_1',
    accountStatus: 'active',
    emailVerifiedAt: verifiedAt,
  },
}

assert.equal(decideSharedLogin(activeMemberSession).destination, '/portal')
assert.equal(decideSharedLogin(activeMemberSession, '/portal/courses').destination, '/portal/courses')

for (const [status, expectedReason] of [
  ['blocked', 'member_blocked'],
  ['suspended', 'member_suspended'],
] as const) {
  const decision = decideSharedLogin({
    administratorId: null,
    member: {
      id: `member_${status}`,
      accountStatus: status,
      emailVerifiedAt: verifiedAt,
    },
  })
  assert.equal(decision.allowed, false)
  assert.equal(decision.reason, expectedReason)
}

const unverifiedDecision = decideSharedLogin({
  administratorId: null,
  member: {
    id: 'member_unverified',
    accountStatus: 'active',
    emailVerifiedAt: null,
  },
})
assert.equal(unverifiedDecision.allowed, false)
assert.equal(unverifiedDecision.reason, 'member_email_unverified')

const unknownCollectionDecision = decideSharedLogin({
  administratorId: null,
  member: null,
  unresolvedCollection: true,
})
assert.equal(unknownCollectionDecision.allowed, false)
assert.equal(unknownCollectionDecision.reason, 'authenticated_collection_unrecognized')

const dualRoleDecision = decideSharedLogin(dualRole)
assert.equal(dualRoleDecision.allowed, false)
assert.equal(dualRoleDecision.reason, 'explicit_domain_required')
assert.equal(decideSharedLogin(dualRole, '/admin').destination, '/admin')
assert.equal(decideSharedLogin(dualRole, '/portal/courses').destination, '/portal/courses')

assert.equal(decideSharedLogin({ administratorId: 'admin_1', member: null }, 'https://evil.example/admin').destination, '/admin')
assert.equal(decideSharedLogin(activeMemberSession, '//evil.example/portal').destination, '/portal')
assert.equal(decideSharedLogin(activeMemberSession, '/admin').allowed, false)

assert.equal(sanitizeInternalDestination('/admin'), '/admin')
assert.equal(sanitizeInternalDestination('/admin/collections/payload_users?tab=1'), '/admin/collections/payload_users?tab=1')
assert.equal(sanitizeInternalDestination('/portal'), '/portal')
assert.equal(sanitizeInternalDestination('/portal/courses#current'), '/portal/courses#current')
assert.equal(sanitizeInternalDestination('https://evil.example/admin'), null)
assert.equal(sanitizeInternalDestination('//evil.example/admin'), null)
assert.equal(sanitizeInternalDestination('/operations/partners-clicks'), null)
assert.equal(sanitizeInternalDestination('/admin\\evil'), null)
assert.equal(sanitizeInternalDestination('/%2F%2Fevil.example'), null)
assert.equal(sanitizeInternalDestination(undefined, '/portal'), '/portal')

console.log('payload_identity_destination.test.ts passed')
