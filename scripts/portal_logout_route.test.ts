import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync('src/app/api/portal/logout/route.ts', 'utf8')
const sidebar = readFileSync('src/components/portal/PortalSidebar.tsx', 'utf8')
const accountLogout = readFileSync('src/components/auth/MemberLogoutButton.tsx', 'utf8')
const loginForm = readFileSync('src/components/auth/MemberLoginForm.tsx', 'utf8')

assert.match(route, /export async function POST/, 'portal logout must expose a POST handler')
assert.match(route, /await cookies\(\)/, 'portal logout must inspect the incoming cookies')
assert.match(route, /cookie\.name\.startsWith\(prefix\)/, 'portal logout must clear every Payload auth cookie')
assert.match(route, /names\.add\(`\$\{prefix\}-token`\)/, 'portal logout must clear the default token cookie')
assert.match(route, /expires: new Date\(0\)/, 'portal logout must expire cookies')
assert.match(route, /path: '\/'/, 'portal logout must clear root-scoped cookies')
assert.match(route, /\/portal\?mode=login&loggedOut=1/, 'portal logout must return the portal login destination')
assert.match(route, /Cache-Control': 'no-store'/, 'portal logout response must not be cached')

for (const [name, source] of [
  ['portal sidebar', sidebar],
  ['account logout button', accountLogout],
  ['member login cleanup', loginForm],
] as const) {
  assert.match(source, /\/api\/portal\/logout/, `${name} must use the shared portal logout endpoint`)
  assert.equal(source.includes('/api/payload_members/logout'), false, `${name} must not call a collection-specific logout endpoint`)
}

assert.match(sidebar, /logoutError/, 'portal sidebar must show logout failures instead of failing silently')

console.log('portal_logout_route.test.ts passed')
