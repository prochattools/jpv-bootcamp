import assert from 'node:assert/strict'
import {
  assertStagingDeployment,
  assertStagingOrigin,
  STAGING_APP_ID,
  STAGING_APP_INTERNAL_ID,
  STAGING_SOURCE_REF_EXAMPLE,
  STAGING_SOURCE_REF_DESCRIPTION,
  STAGING_ORIGIN,
  PRODUCTION_DENY_LIST,
} from './stagingPolicy'

function throws(fn: () => void, pattern: RegExp, label: string): void {
  try {
    fn()
    assert.fail(`${label}: expected throw but did not throw`)
  } catch (e) {
    if (e instanceof assert.AssertionError) throw e
    assert.match((e as Error).message, pattern, `${label}: error message mismatch`)
  }
}

// --- Constants ---
assert.equal(STAGING_APP_ID, 'clients-jpv-bootcamp-preview-wjfqfd', 'staging app slug')
assert.equal(STAGING_APP_INTERNAL_ID, 'bZllV93NqsPZAFCsqDskb', 'staging app ID')
assert.equal(STAGING_ORIGIN, 'https://staging.jpvbootcamp.com', 'staging origin')
assert.equal(STAGING_SOURCE_REF_DESCRIPTION, 'feature/*, fix/*, or release/*', 'staging source refs')
assert.ok(PRODUCTION_DENY_LIST.includes('clients-jpv-bootcamp-app-tp9xrk'), 'deny-list has production slug')
assert.ok(PRODUCTION_DENY_LIST.includes('I_2Vukga3cc3ZhaG-mUzU'), 'deny-list has production ID')
assert.ok(PRODUCTION_DENY_LIST.includes('web-public-jpv-bootcamp-l66egq'), 'deny-list has legacy slug')

// --- assertStagingOrigin: valid ---
assertStagingOrigin('https://staging.jpvbootcamp.com')
assertStagingOrigin('https://staging.jpvbootcamp.com/')

// --- assertStagingOrigin: rejects ---
throws(
  () => assertStagingOrigin('http://staging.jpvbootcamp.com'),
  /HTTPS/,
  'reject HTTP',
)
throws(
  () => assertStagingOrigin('https://staging.jpvbootcamp.com:8443'),
  /non-default port/,
  'reject non-default port',
)
throws(
  () => assertStagingOrigin('https://user:pass@staging.jpvbootcamp.com'),
  /userinfo/,
  'reject userinfo credentials',
)
throws(
  () => assertStagingOrigin('https://evil.staging.jpvbootcamp.com'),
  /hostname/,
  'reject subdomain prefix attack',
)
throws(
  () => assertStagingOrigin('https://staging.jpvbootcamp.com.evil.com'),
  /hostname/,
  'reject suffix domain',
)
throws(
  () => assertStagingOrigin('https://jpvbootcamp.com'),
  /hostname/,
  'reject production origin',
)
throws(
  () => assertStagingOrigin('https://preview.evil.com'),
  /hostname/,
  'reject unrelated preview domain',
)
throws(
  () => assertStagingOrigin('https://staging.jpvbootcamp.com/admin'),
  /path/,
  'reject URL with path',
)
throws(
  () => assertStagingOrigin('https://staging.jpvbootcamp.com?foo=bar'),
  /path/,
  'reject URL with query string',
)
throws(
  () => assertStagingOrigin('not-a-url'),
  /cannot parse/,
  'reject unparseable URL',
)

// --- assertStagingDeployment: valid ---
assertStagingDeployment({
  appId: STAGING_APP_ID,
  origin: STAGING_ORIGIN,
  branch: STAGING_SOURCE_REF_EXAMPLE,
})

for (const sourceRef of ['feature/course-branding-and-preview', 'fix/recovery', 'release/2026.08.28']) {
  assertStagingDeployment({ appId: STAGING_APP_INTERNAL_ID, origin: STAGING_ORIGIN, branch: sourceRef })
}

// --- assertStagingDeployment: deny-listed production app ID ---
throws(
  () =>
    assertStagingDeployment({
      appId: 'web-public-jpv-bootcamp-l66egq',
      origin: STAGING_ORIGIN,
      branch: STAGING_SOURCE_REF_EXAMPLE,
    }),
  /DEPLOY-DENIED.*deny-list/,
  'deny-listed production app ID blocked',
)

// --- assertStagingDeployment: wrong app ID ---
throws(
  () =>
    assertStagingDeployment({
      appId: 'some-other-app',
      origin: STAGING_ORIGIN,
      branch: STAGING_SOURCE_REF_EXAMPLE,
    }),
  /not an allowed staging app ID/,
  'wrong app ID blocked',
)

// --- assertStagingDeployment: production origin ---
throws(
  () =>
    assertStagingDeployment({
      appId: STAGING_APP_ID,
      origin: 'https://jpvbootcamp.com',
      branch: STAGING_SOURCE_REF_EXAMPLE,
    }),
  /hostname/,
  'production origin rejected',
)

// --- assertStagingDeployment: main branch ---
throws(
  () =>
    assertStagingDeployment({
      appId: STAGING_APP_ID,
      origin: STAGING_ORIGIN,
      branch: 'main',
    }),
  /not allowed/,
  'main branch rejected',
)

// --- assertStagingDeployment: generic DOKPLOY_APP_ID scenario ---
throws(
  () =>
    assertStagingDeployment({
      appId: 'web-public-jpv-bootcamp-l66egq',
      origin: STAGING_ORIGIN,
      branch: STAGING_SOURCE_REF_EXAMPLE,
    }),
  /DEPLOY-DENIED/,
  'generic app ID set to production denied',
)

// --- deny-list cannot be bypassed by matching origin/branch ---
throws(
  () =>
    assertStagingDeployment({
      appId: 'web-public-jpv-bootcamp-l66egq',
      origin: STAGING_ORIGIN,
      branch: STAGING_SOURCE_REF_EXAMPLE,
    }),
  /deny-list/,
  'deny-list checked before any other condition',
)

console.log('deploymentPolicy.test.ts passed — 18 assertions')
