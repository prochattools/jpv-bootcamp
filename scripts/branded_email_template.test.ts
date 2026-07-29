import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'

import { jpvBrand, jpvCssVariables, jpvDesignTokens } from '../src/lib/brand/jpvDesignSystem'
import { escapeEmailHtml, renderBrandedEmail } from '../src/lib/communications/brandedEmail'

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : [path]
  })
}

const hostile = `Alex <script>alert('x')</script> & "friends"`
const escaped = escapeEmailHtml(hostile)
assert.equal(escaped, 'Alex &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt; &amp; &quot;friends&quot;')

const html = renderBrandedEmail({
  preheader: hostile,
  heading: hostile,
  logoUrl: 'https://example.test/logo.png?label="unsafe"',
  bodyHtml: `<p>${escaped}</p>`,
  actions: [{ label: hostile, url: 'https://example.test/path?next="quoted"' }],
})

assert.ok(html.includes(`<p>${escaped}</p>`), 'caller-sanitized body markup should be preserved')
assert.ok(!html.includes('<script>'), 'dynamic text must not create script markup')
assert.ok(html.includes('Alex &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;'))
assert.ok(html.includes('logo.png?label=&quot;unsafe&quot;'))
assert.ok(html.includes('path?next=&quot;quoted&quot;'))
assert.ok(html.includes(`background:${jpvDesignTokens.colors.surface}`))
assert.ok(html.includes(`border-radius:${jpvDesignTokens.radius.action}`))
assert.ok(html.includes(`border-radius:${jpvDesignTokens.radius.panel}`))
assert.ok(html.includes(`font-family:${jpvDesignTokens.typography.emailEditorial}`))
assert.equal(html.includes('border-radius:999px'), false, 'email actions must use the global action radius')
assert.ok(html.includes(jpvBrand.logoAlt))
assert.ok(html.includes(jpvBrand.tagline))

const previousAppBaseUrl = process.env.APP_BASE_URL
process.env.APP_BASE_URL = 'https://preview.jpvbootcamp.test'
const defaultLogoHtml = renderBrandedEmail({
  preheader: 'Logo contract',
  heading: 'Logo contract',
  bodyHtml: '<p>Logo contract</p>',
})
if (previousAppBaseUrl === undefined) delete process.env.APP_BASE_URL
else process.env.APP_BASE_URL = previousAppBaseUrl

assert.ok(
  defaultLogoHtml.includes('src="https://preview.jpvbootcamp.test/images/jpv-logo.jpg"'),
  'default email logo must use an absolute public HTTPS URL',
)
assert.equal(
  defaultLogoHtml.includes('src="/images/jpv-logo.jpg"'),
  false,
  'transactional emails must never emit a relative logo URL',
)
assert.ok(defaultLogoHtml.includes('width="64" height="64"'))
assert.ok(defaultLogoHtml.includes('max-width:64px'))

const globalStyles = readFileSync('src/assets/styles/globals.scss', 'utf8')
const landingStyles = readFileSync('src/app/(frontend)/landing.module.scss', 'utf8')
const adminStyles = readFileSync('src/app/(payload)/jpv-admin.scss', 'utf8')
const providers = readFileSync('src/components/providers.tsx', 'utf8')
const frontendLayout = readFileSync('src/app/(frontend)/layout.tsx', 'utf8')
const payloadLayout = readFileSync('src/app/(payload)/layout.tsx', 'utf8')
const tailwind = readFileSync('tailwind.config.ts', 'utf8')
const designContract = readFileSync('DESIGN.md', 'utf8')

assert.ok(globalStyles.includes('border-radius: var(--jpv-radius-action)'))
assert.ok(globalStyles.includes("button:not([role='switch'])"))
assert.ok(globalStyles.includes('.jpv-product-shell:has(.jpv-auth-shell) > main'))
assert.ok(landingStyles.includes('border-radius: var(--jpv-radius-action)'))
assert.ok(landingStyles.includes('border-radius: var(--jpv-radius-control)'))
assert.ok(adminStyles.includes('border-radius: var(--jpv-radius-action)'))
assert.ok(providers.includes("borderRadius: 'var(--jpv-radius-card)'"))
assert.equal(landingStyles.includes('--landing-ink:'), false, 'landing must consume global tokens')
assert.ok(frontendLayout.includes('style={jpvCssVariables}'))
assert.ok(payloadLayout.includes('style: jpvCssVariables'))
assert.ok(tailwind.includes("import { jpvDesignTokens } from \"./src/lib/brand/jpvDesignSystem\""))
assert.ok(tailwind.includes('DEFAULT: "var(--jpv-brand)"'))
assert.ok(tailwind.includes('"jpv-action": jpvDesignTokens.radius.action'))
assert.match(designContract, /Design lock — approved 21 July 2026/)
assert.equal(Object.keys(jpvCssVariables).length >= 20, true)

const logoFile = join('public', jpvBrand.logoPath.replace(/^\//, ''))
assert.equal(existsSync(logoFile), true, `canonical logo must exist: ${logoFile}`)

const runtimeSources = sourceFiles('src').filter((path) => ['.ts', '.tsx', '.scss', '.css'].includes(extname(path)))
const logoLiterals = runtimeSources.filter((path) => {
  if (path.endsWith('src/lib/brand/jpvDesignSystem.ts')) return false
  return /\/(?:images|assets)\/jpv-logo\.(?:png|jpe?g)/i.test(readFileSync(path, 'utf8'))
})
assert.deepEqual(logoLiterals, [], `runtime logo paths must resolve through jpvBrand: ${logoLiterals.join(', ')}`)

const tokenizedProductSurfaces = [
  'src/app/(frontend)/course-preview/page.tsx',
  'src/app/(frontend)/course-preview/[courseSlug]/page.tsx',
  'src/app/(frontend)/course-preview/[courseSlug]/[lessonSlug]/page.tsx',
  'src/app/(frontend)/portal/community/page.tsx',
  'src/app/(frontend)/portal/community/[spaceSlug]/page.tsx',
  'src/app/(frontend)/portal/community/[spaceSlug]/posts/[postId]/page.tsx',
  'src/app/(frontend)/portal/community/moderation/page.tsx',
  'src/app/(frontend)/portal/community/submissions/page.tsx',
  'src/components/payload/JPVAdminDashboard.tsx',
]

for (const path of tokenizedProductSurfaces) {
  const source = readFileSync(path, 'utf8')
  assert.doesNotMatch(source, /#[0-9a-f]{3,8}\b|rgba?\(/i, `${path} must use the global palette`)
  assert.doesNotMatch(source, /rounded-\[[0-9]+px\]|shadow-\[/, `${path} must use global radius and shadow tokens`)
}

console.log('branded_email_template.test.ts passed')
