import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as { scripts?: Record<string, string> }
const config = readFileSync('playwright-a6-authenticated-staging.config.ts', 'utf8')
const spec = readFileSync('e2e/a6-authenticated-staging.spec.ts', 'utf8')
const workflow = readFileSync('.github/workflows/deploy-preview.yml', 'utf8')

assert.equal(packageJson.scripts?.['test:e2e:staging:authenticated'], 'playwright test --config playwright-a6-authenticated-staging.config.ts')
for (const name of ['STAGING_URL', 'STAGING_MEMBER_EMAIL', 'STAGING_MEMBER_PASSWORD', 'STAGING_ADMIN_EMAIL', 'STAGING_ADMIN_PASSWORD']) {
  assert.match(config, new RegExp(name))
  assert.match(spec, new RegExp(name))
}
assert.match(config, /assertStagingOrigin\(STAGING_BASE_URL\)/)
assert.match(config, /trace: 'off'/)
assert.match(config, /screenshot: 'off'/)
assert.match(config, /video: 'off'/)
for (const width of [320, 375, 768, 1024, 1440]) assert.match(spec, new RegExp(`width: ${width}`))
for (const control of ['Helpful', 'Insightful', 'Celebrate', 'Bookmark', 'Share']) assert.match(spec, new RegExp(control))
assert.match(spec, /status\(\)\)\.toBe\(403\)/)
assert.match(spec, /Turn admin mode off/)
assert.match(spec, /Turn admin mode on/)
assert.match(workflow, /authenticated-acceptance/)
assert.match(workflow, /pnpm test:e2e:staging:authenticated/)
assert.match(workflow, /STAGING_MEMBER_EMAIL: \$\{\{ secrets\.STAGING_MEMBER_EMAIL \}\}/)
assert.match(workflow, /STAGING_MEMBER_PASSWORD: \$\{\{ secrets\.STAGING_MEMBER_PASSWORD \}\}/)
assert.match(workflow, /A6-AUTH-DENIED: add STAGING_MEMBER_EMAIL and STAGING_MEMBER_PASSWORD as protected staging secrets/)
assert.doesNotMatch(workflow, /echo\s+.*\$\{\{\s*secrets\./i)

console.log('A6 authenticated gate contract: PASS')
