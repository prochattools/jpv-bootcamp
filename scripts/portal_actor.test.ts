import assert from 'node:assert/strict'

import { derivePortalCapabilities, type AdminActor, type MemberActor } from '../src/lib/auth/portalActor'
import { mapPayloadAuthUser } from '../src/lib/auth/payloadSessionMapping'
import { resolveIdentityDestination } from '../src/lib/auth/identityDestination'

// derivePortalCapabilities — admin actor
const adminActor: AdminActor = { kind: 'admin', administratorId: '1' }
assert.equal(derivePortalCapabilities(adminActor).isPlatformAdmin, true, 'admin -> isPlatformAdmin true')

// derivePortalCapabilities — admin with optional email
const adminActorEmail: AdminActor = { kind: 'admin', administratorId: '99', email: 'admin@example.com' }
assert.equal(derivePortalCapabilities(adminActorEmail).isPlatformAdmin, true)

// derivePortalCapabilities — member actor
const memberActor: MemberActor = { kind: 'member', memberId: '42', email: 'test@example.com' }
assert.equal(derivePortalCapabilities(memberActor).isPlatformAdmin, false, 'member -> isPlatformAdmin false')

// Capability is auth-derived — AdminModeContext.adminModeOn is client-only UX state.
// A server action must call requirePortalAccess() to re-derive the actor from session cookies.
// No client-sent flag can elevate a MemberActor to admin.
const spoofedMember: MemberActor = { kind: 'member', memberId: '42', email: 'spoof@example.com' }
assert.equal(derivePortalCapabilities(spoofedMember).isPlatformAdmin, false, 'member stays non-admin regardless of UI state')

// mapPayloadAuthUser — admin collection
const adminSession = mapPayloadAuthUser({ id: 'a1', collection: 'payload_users' })
assert.equal(adminSession.administratorId, 'a1')
assert.equal(adminSession.member, null)
assert.equal(adminSession.unresolvedCollection, false)

// mapPayloadAuthUser — member collection
const memberSession = mapPayloadAuthUser({ id: '42', collection: 'payload_members' })
assert.equal(memberSession.administratorId, null)
assert.ok(memberSession.member)
assert.equal(String(memberSession.member!.id), '42')
assert.equal(memberSession.unresolvedCollection, false)

// mapPayloadAuthUser — anonymous
const anonSession = mapPayloadAuthUser(null)
assert.equal(anonSession.administratorId, null)
assert.equal(anonSession.member, null)

// mapPayloadAuthUser — unrecognized collection
const unknownSession = mapPayloadAuthUser({ id: '99', collection: 'some_other_collection' })
assert.equal(unknownSession.administratorId, null)
assert.equal(unknownSession.member, null)
assert.equal(unknownSession.unresolvedCollection, true)

// identityDestination: admin requesting member domain is BLOCKED by decideSharedLogin.
// This is why requirePortalAccess bypasses decideSharedLogin for the admin case.
const adminMemberBlock = resolveIdentityDestination({ administratorId: '1', requestedDomain: 'member' })
assert.equal(adminMemberBlock.allowed, false)
assert.equal(adminMemberBlock.reason, 'requested_domain_unavailable')

// identityDestination: admin with no domain -> allowed to admin surface
const adminNoDomain = resolveIdentityDestination({ administratorId: '1' })
assert.equal(adminNoDomain.kind, 'administrator')
assert.equal(adminNoDomain.allowed, true)

// identityDestination: blocked member
const blockedMember = resolveIdentityDestination({ member: { id: '10', accountStatus: 'blocked', emailVerifiedAt: null } })
assert.equal(blockedMember.kind, 'blocked')
assert.equal(blockedMember.allowed, false)

// identityDestination: suspended member
const suspendedMember = resolveIdentityDestination({ member: { id: '10', accountStatus: 'suspended', emailVerifiedAt: null } })
assert.equal(suspendedMember.kind, 'suspended')
assert.equal(suspendedMember.allowed, false)

// identityDestination: dual role, no domain -> explicit domain required
const dualRole = resolveIdentityDestination({
  administratorId: '1',
  member: { id: '10', accountStatus: 'active', emailVerifiedAt: '2026-01-01T00:00:00Z' },
})
assert.equal(dualRole.kind, 'dual_role')
assert.equal(dualRole.allowed, false)
assert.equal(dualRole.reason, 'explicit_domain_required')

console.log('portal actor tests passed')
