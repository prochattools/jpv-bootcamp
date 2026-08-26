import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const importMap = readFileSync('src/app/(payload)/admin/importMap.js', 'utf8')
const livesessionSource = readFileSync('src/collections/PayloadLiveSession.ts', 'utf8')
const bunnySource = readFileSync('src/collections/PayloadBunnyVideo.ts', 'utf8')
const payloadConfig = readFileSync('src/payload.config.ts', 'utf8')

// Required admin components must appear in the generated importmap
const requiredKeys = [
  './components/payload/JPVAdminBranding#JPVAdminLogo',
  './components/payload/JPVAdminBranding#JPVAdminIcon',
  './components/payload/JPVAdminDashboard#JPVAdminDashboard',
]
for (const key of requiredKeys) {
  assert.ok(
    importMap.includes(`"${key}"`),
    `importMap.js must contain key "${key}" — run pnpm generate:importmap to regenerate`,
  )
}

// Required admin component imports must appear in the importmap
assert.match(importMap, /import \{ JPVAdminLogo as /, 'importMap.js must import JPVAdminLogo')
assert.match(importMap, /import \{ JPVAdminIcon as /, 'importMap.js must import JPVAdminIcon')
assert.match(importMap, /import \{ JPVAdminDashboard as /, 'importMap.js must import JPVAdminDashboard')

// Collection config files must not import server-only — they are loaded by the Payload CLI
// (generate:importmap) outside the Next.js react-server condition, so server-only unconditionally throws.
assert.doesNotMatch(
  livesessionSource,
  /^import ['"]server-only['"]/m,
  "PayloadLiveSession.ts must not import 'server-only' — Payload CLI cannot run under the react-server condition",
)
assert.doesNotMatch(
  bunnySource,
  /^import ['"]server-only['"]/m,
  "PayloadBunnyVideo.ts must not import 'server-only' — Payload CLI cannot run under the react-server condition",
)

// Collection config files must not import server-only transitively via livekit-config
// (livekit-config.ts contains server secrets and has server-only; it must not be imported in collection configs)
assert.doesNotMatch(
  livesessionSource,
  /from ['"]@\/lib\/livekit-config['"]/,
  'PayloadLiveSession.ts must not import livekit-config (has server-only); inline pure utilities instead',
)

// Payload config must still register the collections
assert.ok(payloadConfig.includes('PayloadLiveSession'), 'payload.config.ts must register PayloadLiveSession')
assert.ok(payloadConfig.includes('PayloadBunnyVideo'), 'payload.config.ts must register PayloadBunnyVideo')

console.log('payload importmap contract tests passed')
