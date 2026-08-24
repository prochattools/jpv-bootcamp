import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve('src/lib/auth/requirePortalAccess.ts'), 'utf8')

// Must be server-only
assert.match(source, /^import ['"]server-only['"]/m, 'requirePortalAccess is server-only')

// Must export PortalAccessContext and requirePortalAccess
assert.match(source, /export type PortalAccessContext/, 'exports PortalAccessContext')
assert.match(source, /export async function requirePortalAccess/, 'exports requirePortalAccess')

// Admin check must precede the decideSharedLogin CALL (not the import line)
const adminCheckPos = source.indexOf('session.administratorId')
const decideCallPos = source.indexOf('decideSharedLogin(')
assert.ok(adminCheckPos !== -1, 'checks session.administratorId')
assert.ok(decideCallPos !== -1, 'calls decideSharedLogin for non-admin path')
assert.ok(
  adminCheckPos < decideCallPos,
  'admin short-circuit precedes decideSharedLogin call — admins bypass domain routing'
)

// Admin guard block must return early before reaching decideSharedLogin
const adminGuard = source.slice(adminCheckPos, decideCallPos)
assert.match(adminGuard, /return\s*\{/, 'admin path returns early — never reaches member domain routing')

// Must fail closed with redirect
assert.match(source, /redirect\(/, 'fails closed with redirect on authentication failure')

// AdminGate must be a pure presentation component — no auth logic
const gateSource = readFileSync(resolve('src/components/portal/AdminGate.tsx'), 'utf8')
assert.doesNotMatch(gateSource, /server-only/, 'AdminGate has no server-only dependency')
assert.doesNotMatch(gateSource, /^import.*requirePortalAccess/m, 'AdminGate does not import requirePortalAccess')
assert.doesNotMatch(gateSource, /^import.*cachedResolvePayloadRequestSession/m, 'AdminGate does not import session resolver')
assert.match(gateSource, /useAdminMode/, 'AdminGate reads from useAdminMode context')

// AdminModeContext must be client-side only — no server auth
const ctxSource = readFileSync(resolve('src/components/portal/AdminModeContext.tsx'), 'utf8')
assert.doesNotMatch(ctxSource, /server-only/, 'AdminModeContext has no server-only dependency')
assert.doesNotMatch(ctxSource, /^import.*requirePortalAccess/m, 'AdminModeContext does not import requirePortalAccess')
assert.match(ctxSource, /AdminModeProvider/, 'exports AdminModeProvider')
assert.match(ctxSource, /useAdminMode/, 'exports useAdminMode')

// PortalLayout derives isAdmin server-side (cannot be spoofed by client)
const layoutSource = readFileSync(resolve('src/app/(frontend)/portal/layout.tsx'), 'utf8')
assert.match(layoutSource, /isAdmin/, 'PortalLayout derives and passes isAdmin')
assert.match(layoutSource, /administratorId/, 'isAdmin is derived from server-side session.administratorId')

// PortalShell provides AdminModeProvider — isAdmin threaded from server into client context
const shellSource = readFileSync(resolve('src/components/portal/PortalShell.tsx'), 'utf8')
assert.match(shellSource, /AdminModeProvider/, 'PortalShell wraps with AdminModeProvider')
assert.match(shellSource, /isAdmin/, 'PortalShell accepts isAdmin prop')

console.log('portal access tests passed')
