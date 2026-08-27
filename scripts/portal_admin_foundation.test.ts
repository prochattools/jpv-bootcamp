import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { derivePortalCapabilities, type MemberActor } from '../src/lib/auth/portalActor'
import {
  normalizePortalAdminError,
  PortalAdminActionError,
} from '../src/lib/portalAdmin/actionResult'

const root = resolve(__dirname, '..')
const source = (path: string) => readFileSync(resolve(root, path), 'utf8')
const withoutComments = (value: string) =>
  value.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')

const memberActor: MemberActor = { kind: 'member', memberId: 'member-1', email: 'member@example.com' }

// 1-2. The canonical gate rejects members and narrows only admin actors.
const requireAdminSource = source('src/lib/auth/requirePortalAdmin.ts')
assert.match(requireAdminSource, /if \(access\.actor\.kind !== 'admin'\)/)
assert.match(requireAdminSource, /actor: access\.actor/)
assert.match(requireAdminSource, /privilegedPayloadAccess\(access\.actor/)

// 3. Unauthenticated requests still fail closed through requirePortalAccess.
const accessSource = source('src/lib/auth/requirePortalAccess.ts')
assert.match(requireAdminSource, /requirePortalAccess\(/)
assert.match(requireAdminSource, /actor\.kind !== 'admin'/)
assert.match(accessSource, /redirect\(/)

// 4. Server authorization is independent of the client AdminGate/AdminMode UI.
assert.equal(derivePortalCapabilities(memberActor).isPlatformAdmin, false)
const gateSource = source('src/components/portal/AdminGate.tsx')
assert.doesNotMatch(withoutComments(gateSource), /requirePortalAccess|cachedResolvePayloadRequestSession|server-only/)

// 5. Member-only access remains a separate boundary.
const memberSource = source('src/lib/auth/requirePortalMember.ts')
assert.match(memberSource, /^import ['"]server-only['"]/m)
assert.match(memberSource, /export async function requirePortalMember/)
assert.doesNotMatch(memberSource, /requirePortalAdmin/)

// 6. Shared portal access still exposes the actor union.
assert.match(accessSource, /type PortalActor/)
assert.match(accessSource, /kind: 'admin'/)
assert.match(accessSource, /kind: 'member'/)

// 7. Unexpected internal details are logged server-side and never serialized.
const originalConsoleError = console.error
console.error = () => undefined
try {
  const result = normalizePortalAdminError(new Error('secret provider token'), 'foundation-test')
  assert.equal(result.ok, false)
  if (result.ok === false) {
    assert.equal(result.code, 'internal_error')
    assert.equal(result.message, 'The request could not be completed.')
    assert.doesNotMatch(result.message, /secret provider token/)
  }
} finally {
  console.error = originalConsoleError
}

// Scoped Server Actions use the canonical boundary and result translator.
for (const path of [
  'src/lib/portalAdmin/courseAdminActions.ts',
  'src/lib/portalAdmin/communityAdminActions.ts',
]) {
  const actionSource = source(path)
  assert.match(actionSource, /requirePortalAdmin\('/)
  assert.match(actionSource, /normalizePortalAdminError\(/)
  assert.doesNotMatch(actionSource, /function requireAdmin|requirePortalAccess\(/)
  assert.doesNotMatch(actionSource, /return \{ ok: false, error:/)
}

const privilegedSource = source('src/lib/payload/privilegedAccess.ts')
assert.match(privilegedSource, /^import ['"]server-only['"]/m)
assert.match(privilegedSource, /overrideAccess: true/)

console.log('portal admin foundation tests passed')
