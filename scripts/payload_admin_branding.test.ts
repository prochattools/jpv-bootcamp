import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

import { jpvBrand } from '../src/lib/brand/jpvDesignSystem'
import { resolveJpvLogoUrl } from '../src/lib/brand/jpvDesignSystem'
import { getPublicBaseUrl } from '../src/lib/public-base-url'

const payloadConfig = readFileSync('src/payload.config.ts', 'utf8')
const brandingSource = readFileSync('src/components/payload/JPVAdminBranding.tsx', 'utf8')
const importMap = readFileSync('src/app/(payload)/admin/importMap.js', 'utf8')
const rootImportMap = readFileSync('src/app/(payload)/importMap.js', 'utf8')
const dockerfile = readFileSync('Dockerfile', 'utf8')

const logoKey = './components/payload/JPVAdminBranding#JPVAdminLogo'
const iconKey = './components/payload/JPVAdminBranding#JPVAdminIcon'

assert.ok(payloadConfig.includes(logoKey), 'payload.config.ts must configure JPVAdminLogo')
assert.ok(payloadConfig.includes(iconKey), 'payload.config.ts must configure JPVAdminIcon')
assert.match(payloadConfig, /resolveJpvLogoUrl\(getPublicBaseUrl\(\)\)/, 'Payload metadata icons must use an absolute public logo URL')
const resolvedLogoUrl = resolveJpvLogoUrl(getPublicBaseUrl())
assert.equal(resolvedLogoUrl, new URL(jpvBrand.logoPath, getPublicBaseUrl()).toString())
assert.match(resolvedLogoUrl, /^https:\/\//, 'Payload metadata logo URL must be absolute HTTPS')
assert.doesNotMatch(payloadConfig, /url:\s*jpvBrand\.logoPath/, 'Payload metadata must not receive a relative logo path')
assert.doesNotMatch(
  payloadConfig,
  /beforeLogin:\s*\[/,
  'payload.config.ts must not add a second logo through beforeLogin',
)
assert.match(brandingSource, /export function JPVAdminLogo\(/, 'JPVAdminLogo export is required')
assert.match(brandingSource, /export function JPVAdminIcon\(/, 'JPVAdminIcon export is required')
assert.doesNotMatch(
  brandingSource,
  /JPVAdminLoginBranding/,
  'extra admin login branding must not duplicate the configured logo',
)
assert.ok(brandingSource.includes('jpvBrand.logoPath'), 'branding must use the canonical JPV brand asset')
assert.ok(existsSync(`public${jpvBrand.logoPath}`), `public${jpvBrand.logoPath} must exist`)
assert.match(importMap, /import \{ JPVAdminLogo as /, 'import map must import JPVAdminLogo')
assert.match(importMap, /import \{ JPVAdminIcon as /, 'import map must import JPVAdminIcon')
assert.ok(importMap.includes(`"${logoKey}"`), 'import map object must contain the JPVAdminLogo key')
assert.ok(importMap.includes(`"${iconKey}"`), 'import map object must contain the JPVAdminIcon key')
assert.doesNotMatch(
  importMap,
  /JPVAdminLoginBranding/,
  'import map must not include the duplicate login branding component',
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
