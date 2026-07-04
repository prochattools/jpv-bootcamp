import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const requirePortalMember = readFileSync('src/lib/auth/requirePortalMember.ts', 'utf8')
const portalPage = readFileSync('src/app/(frontend)/portal/page.tsx', 'utf8')
const loginPage = readFileSync('src/app/(frontend)/login/page.tsx', 'utf8')
const learnLoginPage = readFileSync('src/app/(frontend)/learn/login/page.tsx', 'utf8')
const verificationHttp = readFileSync('src/lib/auth/memberEmailVerificationHttp.ts', 'utf8')
const emailChangeComplete = readFileSync('src/app/api/member-email-change/complete/route.ts', 'utf8')
const passwordReset = readFileSync('src/app/api/member-password/reset/route.ts', 'utf8')
const memberSetup = readFileSync('src/app/api/member-invitations/complete/route.ts', 'utf8')

assert.match(requirePortalMember, /\/portal\?mode=login&next=/)
assert.doesNotMatch(requirePortalMember, /redirect\(`\/login/)

assert.match(portalPage, /firstValue\(params\?\.mode\) === 'login'/)
assert.match(portalPage, /MemberLoginForm/)
assert.match(portalPage, /MemberVerificationResendForm/)
assert.match(portalPage, /Create free account/)
assert.match(portalPage, /Forgot password/)
assert.match(portalPage, /\/admin/)

assert.match(loginPage, /new URLSearchParams\(\{ mode: 'login' \}\)/)
assert.match(loginPage, /redirect\(`\/portal/)
assert.doesNotMatch(loginPage, /MemberLoginForm/)

assert.match(learnLoginPage, /redirect\('\/portal\?mode=login'\)/)
assert.doesNotMatch(learnLoginPage, /LoginForm/)

assert.match(verificationHttp, /new URL\('\/portal'/)
assert.match(verificationHttp, /mode', 'login'/)
assert.match(emailChangeComplete, /new URL\('\/portal'/)
assert.match(passwordReset, /destination: '\/portal\?mode=login'/)
assert.match(memberSetup, /destination: '\/portal\?mode=login'/)

console.log('payload_member_auth_architecture.test.ts passed')
