import assert from 'node:assert/strict'

import {
  GENERIC_MEMBER_LOGIN_ERROR,
  MEMBER_LOGIN_PAGE_DENIED_MESSAGE,
  UNAVAILABLE_MEMBER_LOGIN_ERROR,
  VERIFICATION_MEMBER_LOGIN_ERROR,
  getMemberLoginPageMessage,
  getMemberLoginErrorMessage,
  parseMemberSessionResponse,
  resolveMemberDestination,
  shouldClearDeniedMemberSession,
} from '../src/lib/auth/memberLoginFlow'
import { decideSharedLogin } from '../src/lib/auth/sharedLoginDecision'

const verifiedMember = {
  id: 42,
  accountStatus: 'active',
  emailVerifiedAt: '2026-06-30T12:00:00.000Z',
}

assert.equal(decideSharedLogin({ administratorId: null, member: null }).allowed, false)
assert.deepEqual(decideSharedLogin({ administratorId: null, member: verifiedMember }), {
  allowed: true,
  destination: '/portal',
  identity: {
    kind: 'member',
    allowed: true,
    destination: '/portal',
    reason: 'active_verified_member',
  },
  reason: 'active_verified_member',
})
assert.equal(
  decideSharedLogin({ administratorId: null, member: verifiedMember }, '/portal/courses').destination,
  '/portal/courses',
)

for (const accountStatus of ['pending', 'blocked', 'suspended', 'deleted', 'unexpected']) {
  const decision = decideSharedLogin({
    administratorId: null,
    member: { ...verifiedMember, accountStatus },
  })
  assert.equal(decision.allowed, false, `${accountStatus} must be denied`)
}

assert.equal(
  decideSharedLogin({
    administratorId: null,
    member: { ...verifiedMember, emailVerifiedAt: null },
  }).allowed,
  false,
)
const memberAdminRequest = decideSharedLogin(
  { administratorId: null, member: verifiedMember },
  '/admin',
)
assert.equal(memberAdminRequest.allowed, false)
assert.equal(memberAdminRequest.destination, null)
assert.notEqual(memberAdminRequest.identity.kind, 'administrator')
assert.equal(
  decideSharedLogin({ administratorId: 7, member: null }, '/portal').allowed,
  false,
)

assert.equal(resolveMemberDestination('/portal'), '/portal')
assert.equal(resolveMemberDestination('/portal/courses'), '/portal/courses')
assert.equal(resolveMemberDestination('/admin'), '/portal')
assert.equal(resolveMemberDestination('https://evil.example'), '/portal')
assert.equal(resolveMemberDestination('//evil.example'), '/portal')
assert.equal(resolveMemberDestination('/portal\\evil'), '/portal')
assert.equal(resolveMemberDestination('/portal/%E0%A4%A'), '/portal')

const allowed = parseMemberSessionResponse({ allowed: true, destination: '/portal/courses' })
assert.deepEqual(allowed, { allowed: true, destination: '/portal/courses' })
assert.equal(parseMemberSessionResponse({ allowed: true, destination: '/admin' }).allowed, false)
assert.equal(
  parseMemberSessionResponse({ allowed: true, destination: 'https://evil.example' }).allowed,
  false,
)
assert.equal(parseMemberSessionResponse(null).allowed, false)

const verification = parseMemberSessionResponse({
  allowed: false,
  reason: 'verification_required',
})
assert.equal(getMemberLoginErrorMessage(verification), VERIFICATION_MEMBER_LOGIN_ERROR)

const unavailable = parseMemberSessionResponse({
  allowed: false,
  reason: 'account_unavailable',
})
assert.equal(getMemberLoginErrorMessage(unavailable), UNAVAILABLE_MEMBER_LOGIN_ERROR)

const unauthenticated = parseMemberSessionResponse({
  allowed: false,
  reason: 'unauthenticated',
})
assert.equal(getMemberLoginErrorMessage(unauthenticated), GENERIC_MEMBER_LOGIN_ERROR)
assert.equal(shouldClearDeniedMemberSession(verification), true)
assert.equal(shouldClearDeniedMemberSession(parseMemberSessionResponse({ nope: true })), true)
assert.equal(shouldClearDeniedMemberSession(allowed), false)
assert.equal(getMemberLoginPageMessage('verification_required'), VERIFICATION_MEMBER_LOGIN_ERROR)
assert.notEqual(getMemberLoginPageMessage('verification_required'), MEMBER_LOGIN_PAGE_DENIED_MESSAGE)
assert.equal(
  [
    getMemberLoginPageMessage('verification_required'),
    'This verification link is invalid or expired. You can request another email below.',
  ].includes(MEMBER_LOGIN_PAGE_DENIED_MESSAGE),
  false,
)
assert.equal(getMemberLoginPageMessage('denied'), MEMBER_LOGIN_PAGE_DENIED_MESSAGE)

console.log('payload member authentication flow tests passed')
