import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
}

const routes = {
  forgot: read('src/app/api/member-password/forgot/route.ts'),
  reset: read('src/app/api/member-password/reset/route.ts'),
  invitationComplete: read('src/app/api/member-invitations/complete/route.ts'),
  emailChangeRequest: read('src/app/api/member-profile/email-change/request/route.ts'),
  emailChangeComplete: read('src/app/api/member-email-change/complete/route.ts'),
  verificationComplete: read('src/app/api/member-email-verification/complete/route.ts'),
  verificationResend: read('src/app/api/member-email-verification/resend/route.ts'),
}

for (const [name, source] of Object.entries(routes)) {
  assert.match(source, /export const dynamic = 'force-dynamic'/, name)
  assert.match(source, /Cache-Control': 'no-store'|Response\.redirect/, name)
  assert.doesNotMatch(source, /new Resend|RESEND_API_KEY|emails\.send/, name)
  assert.doesNotMatch(source, /console\.(log|warn|error)/, name)
  assert.doesNotMatch(source, /tokenDigest|providerMessageId|resendEmailId/, name)
}

for (const source of [
  routes.forgot,
  routes.reset,
  routes.invitationComplete,
  routes.emailChangeRequest,
]) {
  assert.match(source, /readBoundedJsonObject\(request\)/)
  assert.doesNotMatch(source, /request\.json\(/)
}

assert.match(routes.forgot, /email\.length > 320/)
assert.match(routes.forgot, /GENERIC_MESSAGE/)
assert.match(routes.forgot, /routeThrottle\(request/)
assert.match(routes.forgot, /scope: 'member-password-forgot'/)
assert.doesNotMatch(routes.forgot, /memberId|actionUrl|token:/)

for (const source of [routes.reset, routes.invitationComplete]) {
  assert.match(source, /token\.length < 20 \|\| token\.length > 512/)
  assert.match(source, /password'\)\.length > 256/)
  assert.match(source, /destination: '\/login'/)
  assert.doesNotMatch(source, /destination: record|redirect|next|callback|returnUrl/)
  assert.doesNotMatch(source, /memberId|actionUrl|password: input|tokenDigest/)
}

assert.match(routes.emailChangeRequest, /getCurrentPayloadMember\(\)/)
assert.match(routes.emailChangeRequest, /sameOriginRequest\(request\)/)
assert.match(routes.emailChangeRequest, /scope: 'member-email-change-request'/)
assert.match(routes.emailChangeRequest, /newEmail\.length > 320/)
assert.match(routes.emailChangeRequest, /current sign-in email remains active/)
assert.doesNotMatch(routes.emailChangeRequest, /new Resend|memberId: result|actionUrl|tokenDigest/)

assert.match(routes.emailChangeComplete, /new URL\('\/login', request\.url\)/)
assert.doesNotMatch(routes.emailChangeComplete, /next|redirect=|callback|returnUrl/)
assert.match(routes.verificationComplete, /new URL\('\/login', request\.url\)/)
assert.match(routes.verificationResend, /GENERIC_VERIFICATION_REQUEST_MESSAGE/)

const verificationHttp = read('src/lib/auth/memberEmailVerificationHttp.ts')
assert.match(verificationHttp, /readBoundedJsonObject\(request\)/)
assert.match(verificationHttp, /scope: 'member-email-verification-resend'/)
assert.doesNotMatch(verificationHttp, /request\.json\(/)

console.log('payload_member_account_email_routes.test.ts passed')
