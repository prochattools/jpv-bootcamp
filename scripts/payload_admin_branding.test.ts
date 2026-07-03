import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const payloadConfig = readFileSync('src/payload.config.ts', 'utf8')
const brandingSource = readFileSync('src/components/payload/JPVAdminBranding.tsx', 'utf8')
const importMap = readFileSync('src/app/(payload)/admin/importMap.js', 'utf8')
const rootImportMap = readFileSync('src/app/(payload)/importMap.js', 'utf8')
const dockerfile = readFileSync('Dockerfile', 'utf8')

const logoKey = './components/payload/JPVAdminBranding#JPVAdminLogo'
const iconKey = './components/payload/JPVAdminBranding#JPVAdminIcon'
const loginBrandingKey = './components/payload/JPVAdminBranding#JPVAdminLoginBranding'

assert.ok(payloadConfig.includes(logoKey), 'payload.config.ts must configure JPVAdminLogo')
assert.ok(iconKey && payloadConfig.includes(iconKey), 'payload.config.ts must configure JPVAdminIcon')
assert.ok(
  payloadConfig.includes(loginBrandingKey),
  'payload.config.ts must render explicit JPV branding before the admin login form',
)
assert.match(brandingSource, /export function JPVAdminLogo\(/, 'JPVAdminLogo export is required')
assert.match(brandingSource, /export function JPVAdminIcon\(/, 'JPVAdminIcon export is required')
assert.match(
  brandingSource,
  /export function JPVAdminLoginBranding\(/,
  'JPVAdminLoginBranding export is required',
)
assert.ok(brandingSource.includes('/images/jpv-logo.png'), 'branding must use the existing JPV logo asset')
assert.ok(brandingSource.includes('Administrator sign-in'), 'admin login must show JPV administrator copy')
assert.ok(existsSync('public/images/jpv-logo.png'), 'public/images/jpv-logo.png must exist')
assert.match(importMap, /import \{ JPVAdminLogo as /, 'import map must import JPVAdminLogo')
assert.match(importMap, /import \{ JPVAdminIcon as /, 'import map must import JPVAdminIcon')
assert.match(
  importMap,
  /import \{ JPVAdminLoginBranding as /,
  'import map must import JPVAdminLoginBranding',
)
assert.ok(importMap.includes(`"${logoKey}"`), 'import map object must contain the JPVAdminLogo key')
assert.ok(importMap.includes(`"${iconKey}"`), 'import map object must contain the JPVAdminIcon key')
assert.ok(
  importMap.includes(`"${loginBrandingKey}"`),
  'import map object must contain the JPVAdminLoginBranding key',
)
assert.match(rootImportMap, /export \{ importMap \} from '\.\/admin\/importMap\.js'/, 'root import map must re-export the generated admin import map')
assert.match(rootImportMap, /export \{ importMap as default \} from '\.\/admin\/importMap\.js'/, 'root import map must provide the generated admin import map as default')

const generateIndex = dockerfile.indexOf('pnpm generate:importmap')
const buildIndex = dockerfile.indexOf('pnpm run build')
assert.ok(generateIndex >= 0, 'Dockerfile must generate the Payload import map')
assert.ok(buildIndex >= 0, 'Dockerfile must run the production build')
assert.ok(generateIndex < buildIndex, 'Dockerfile must generate the import map before building')

assert.equal(
  /Logo:\s*['"]@payloadcms\//.test(payloadConfig),
  false,
  'payload.config.ts must not explicitly restore the default Payload logo',
)
assert.equal(
  /Icon:\s*['"]@payloadcms\//.test(payloadConfig),
  false,
  'payload.config.ts must not explicitly restore the default Payload icon',
)

console.log('payload administrator branding tests passed')
