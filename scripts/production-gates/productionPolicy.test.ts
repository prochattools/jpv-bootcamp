import assert from 'node:assert/strict'
import {
  assertProductionDeployment,
  assertProductionOrigin,
  PRODUCTION_APP_ID,
  PRODUCTION_BRANCH,
  PRODUCTION_ORIGIN,
  STAGING_DENY_LIST,
  STAGING_ORIGIN_DENY_LIST,
} from './productionPolicy'

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
assert.equal(PRODUCTION_APP_ID, 'web-public-jpv-bootcamp-l66egq', 'canonical production app ID')
assert.equal(PRODUCTION_ORIGIN, 'https://jpvbootcamp.com', 'canonical production origin')
assert.equal(PRODUCTION_BRANCH, 'main', 'canonical production branch')
assert.ok(STAGING_DENY_LIST.includes('clients-jpv-bootcamp-app-tp9xrk'), 'staging app ID in deny list')
assert.ok(STAGING_DENY_LIST.includes('I_2Vukga3cc3ZhaG-mUzU'), 'staging internal ID in deny list')
assert.ok(STAGING_ORIGIN_DENY_LIST.includes('https://preview.jpvbootcamp.com'), 'staging origin in deny list')

const VALID_SHA = 'a'.repeat(40)

// --- assertProductionOrigin: valid ---
assertProductionOrigin('https://jpvbootcamp.com')
assertProductionOrigin('https://jpvbootcamp.com/')

// --- assertProductionOrigin: rejects non-HTTPS ---
throws(
  () => assertProductionOrigin('http://jpvbootcamp.com'),
  /HTTPS/,
  'reject HTTP',
)

// --- assertProductionOrigin: rejects non-default port ---
throws(
  () => assertProductionOrigin('https://jpvbootcamp.com:8443'),
  /non-default port/,
  'reject non-default port',
)

// --- assertProductionOrigin: rejects userinfo ---
throws(
  () => assertProductionOrigin('https://user:pass@jpvbootcamp.com'),
  /userinfo/,
  'reject userinfo credentials',
)

// --- assertProductionOrigin: rejects subdomain prefix ---
throws(
  () => assertProductionOrigin('https://www.jpvbootcamp.com'),
  /hostname/,
  'reject www subdomain',
)

// --- assertProductionOrigin: rejects staging origin ---
throws(
  () => assertProductionOrigin('https://preview.jpvbootcamp.com'),
  /hostname/,
  'reject staging origin',
)

// --- assertProductionOrigin: rejects suffix domain ---
throws(
  () => assertProductionOrigin('https://jpvbootcamp.com.evil.com'),
  /hostname/,
  'reject suffix domain attack',
)

// --- assertProductionOrigin: rejects path ---
throws(
  () => assertProductionOrigin('https://jpvbootcamp.com/admin'),
  /path/,
  'reject URL with path',
)

// --- assertProductionOrigin: rejects query ---
throws(
  () => assertProductionOrigin('https://jpvbootcamp.com?foo=bar'),
  /path/,
  'reject URL with query string',
)

// --- assertProductionOrigin: rejects hash ---
throws(
  () => assertProductionOrigin('https://jpvbootcamp.com#section'),
  /path/,
  'reject URL with hash',
)

// --- assertProductionOrigin: rejects unparseable ---
throws(
  () => assertProductionOrigin('not-a-url'),
  /cannot parse/,
  'reject unparseable URL',
)

// --- assertProductionDeployment: valid ---
assertProductionDeployment({
  appId: PRODUCTION_APP_ID,
  origin: PRODUCTION_ORIGIN,
  branch: PRODUCTION_BRANCH,
  expectedSha: VALID_SHA,
})

// --- assertProductionDeployment: rejects staging app IDs ---
throws(
  () =>
    assertProductionDeployment({
      appId: 'clients-jpv-bootcamp-app-tp9xrk',
      origin: PRODUCTION_ORIGIN,
      branch: PRODUCTION_BRANCH,
      expectedSha: VALID_SHA,
    }),
  /PRODUCTION-DEPLOY-DENIED.*staging/,
  'staging app ID rejected',
)

throws(
  () =>
    assertProductionDeployment({
      appId: 'I_2Vukga3cc3ZhaG-mUzU',
      origin: PRODUCTION_ORIGIN,
      branch: PRODUCTION_BRANCH,
      expectedSha: VALID_SHA,
    }),
  /PRODUCTION-DEPLOY-DENIED.*staging/,
  'staging internal ID rejected',
)

// --- assertProductionDeployment: rejects staging origin ---
throws(
  () =>
    assertProductionDeployment({
      appId: PRODUCTION_APP_ID,
      origin: 'https://preview.jpvbootcamp.com',
      branch: PRODUCTION_BRANCH,
      expectedSha: VALID_SHA,
    }),
  /PRODUCTION-DEPLOY-DENIED.*staging origin/,
  'staging origin rejected by deployment policy',
)

// --- assertProductionDeployment: rejects wrong app ID ---
throws(
  () =>
    assertProductionDeployment({
      appId: 'some-other-app',
      origin: PRODUCTION_ORIGIN,
      branch: PRODUCTION_BRANCH,
      expectedSha: VALID_SHA,
    }),
  /not the canonical production app ID/,
  'wrong app ID rejected',
)

// --- assertProductionDeployment: rejects empty app ID ---
throws(
  () =>
    assertProductionDeployment({
      appId: '',
      origin: PRODUCTION_ORIGIN,
      branch: PRODUCTION_BRANCH,
      expectedSha: VALID_SHA,
    }),
  /nonempty/,
  'empty app ID rejected',
)

// --- assertProductionDeployment: rejects non-main branch ---
throws(
  () =>
    assertProductionDeployment({
      appId: PRODUCTION_APP_ID,
      origin: PRODUCTION_ORIGIN,
      branch: 'feature/course-branding-and-preview',
      expectedSha: VALID_SHA,
    }),
  /not the allowed production branch/,
  'feature branch rejected',
)

// --- assertProductionDeployment: rejects develop branch ---
throws(
  () =>
    assertProductionDeployment({
      appId: PRODUCTION_APP_ID,
      origin: PRODUCTION_ORIGIN,
      branch: 'develop',
      expectedSha: VALID_SHA,
    }),
  /not the allowed production branch/,
  'develop branch rejected',
)

// --- assertProductionDeployment: rejects short SHA ---
throws(
  () =>
    assertProductionDeployment({
      appId: PRODUCTION_APP_ID,
      origin: PRODUCTION_ORIGIN,
      branch: PRODUCTION_BRANCH,
      expectedSha: 'abc123',
    }),
  /40-character/,
  'short SHA rejected',
)

// --- assertProductionDeployment: rejects empty SHA ---
throws(
  () =>
    assertProductionDeployment({
      appId: PRODUCTION_APP_ID,
      origin: PRODUCTION_ORIGIN,
      branch: PRODUCTION_BRANCH,
      expectedSha: '',
    }),
  /40-character/,
  'empty SHA rejected',
)

// --- deny-list cannot be bypassed by matching origin/branch/SHA ---
throws(
  () =>
    assertProductionDeployment({
      appId: 'clients-jpv-bootcamp-app-tp9xrk',
      origin: PRODUCTION_ORIGIN,
      branch: PRODUCTION_BRANCH,
      expectedSha: VALID_SHA,
    }),
  /staging/,
  'staging deny-list checked before any other condition',
)

console.log('productionPolicy.test.ts passed — 22 assertions')
