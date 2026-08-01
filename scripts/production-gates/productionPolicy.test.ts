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

function captureError(fn: () => void, label: string): string {
  try {
    fn()
    assert.fail(`${label}: expected throw but did not throw`)
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error
    return (error as Error).message
  }
}

function expectError(fn: () => void, pattern: RegExp, label: string): string {
  const message = captureError(fn, label)
  assert.match(message, pattern, `${label}: error message mismatch`)
  return message
}

function expectRedacted(
  fn: () => void,
  pattern: RegExp,
  sentinel: string,
  label: string,
): void {
  const message = expectError(fn, pattern, label)
  assert.ok(!message.includes(sentinel), `${label}: supplied sentinel must not appear in the error`)
}

assert.equal(PRODUCTION_APP_ID, 'web-public-jpv-bootcamp-l66egq', 'canonical production app ID')
assert.equal(PRODUCTION_ORIGIN, 'https://jpvbootcamp.com', 'canonical production origin')
assert.equal(PRODUCTION_BRANCH, 'main', 'canonical production branch')
assert.ok(STAGING_DENY_LIST.includes('clients-jpv-bootcamp-app-tp9xrk'), 'staging app ID in deny list')
assert.ok(STAGING_DENY_LIST.includes('I_2Vukga3cc3ZhaG-mUzU'), 'staging internal ID in deny list')
assert.ok(STAGING_ORIGIN_DENY_LIST.includes('https://preview.jpvbootcamp.com'), 'staging origin in deny list')

const VALID_SHA = 'a'.repeat(40)
const validContext = {
  appId: PRODUCTION_APP_ID,
  origin: PRODUCTION_ORIGIN,
  branch: PRODUCTION_BRANCH,
  expectedSha: VALID_SHA,
}

assertProductionOrigin('https://jpvbootcamp.com')
assertProductionOrigin('https://jpvbootcamp.com/')

expectError(() => assertProductionOrigin('http://jpvbootcamp.com'), /HTTPS/, 'reject HTTP')
expectError(
  () => assertProductionOrigin('https://jpvbootcamp.com:8443'),
  /non-default port/,
  'reject non-default port',
)
expectError(
  () => assertProductionOrigin('https://user:pass@jpvbootcamp.com'),
  /userinfo/,
  'reject userinfo credentials',
)
expectError(
  () => assertProductionOrigin('https://www.jpvbootcamp.com'),
  /hostname/,
  'reject www subdomain',
)
expectError(
  () => assertProductionOrigin('https://preview.jpvbootcamp.com'),
  /hostname/,
  'reject staging origin',
)
expectError(
  () => assertProductionOrigin('https://jpvbootcamp.com.evil.com'),
  /hostname/,
  'reject suffix domain attack',
)
expectError(
  () => assertProductionOrigin('https://jpvbootcamp.com/admin'),
  /path/,
  'reject URL with path',
)
expectError(
  () => assertProductionOrigin('https://jpvbootcamp.com?foo=bar'),
  /path/,
  'reject URL with query string',
)
expectError(
  () => assertProductionOrigin('https://jpvbootcamp.com#section'),
  /path/,
  'reject URL with hash',
)
expectError(() => assertProductionOrigin('not-a-url'), /cannot parse/, 'reject unparseable URL')

assertProductionDeployment(validContext)

const stagingSentinel = 'SENTINEL_STAGING_APP_ID_MUST_NOT_APPEAR'
STAGING_DENY_LIST.push(stagingSentinel)
try {
  expectRedacted(
    () => assertProductionDeployment({ ...validContext, appId: stagingSentinel }),
    /PRODUCTION-DEPLOY-DENIED.*denied staging identifier/,
    stagingSentinel,
    'staging app identifier is redacted',
  )
} finally {
  STAGING_DENY_LIST.pop()
}

const arbitraryAppSentinel = 'SENTINEL_ARBITRARY_APP_ID_MUST_NOT_APPEAR'
expectRedacted(
  () => assertProductionDeployment({ ...validContext, appId: arbitraryAppSentinel }),
  /does not match the canonical production application/,
  arbitraryAppSentinel,
  'arbitrary app identifier is redacted',
)

expectError(
  () => assertProductionDeployment({ ...validContext, appId: '' }),
  /application ID is required/,
  'empty app ID rejected',
)

const branchSentinel = 'SENTINEL_INVALID_BRANCH_MUST_NOT_APPEAR'
expectRedacted(
  () => assertProductionDeployment({ ...validContext, branch: branchSentinel }),
  /supplied branch is not the production branch/,
  branchSentinel,
  'invalid branch is redacted',
)

const uppercaseShaSentinel = 'A'.repeat(40)
expectRedacted(
  () => assertProductionDeployment({ ...validContext, expectedSha: uppercaseShaSentinel }),
  /full lowercase 40-character hexadecimal commit SHA/,
  uppercaseShaSentinel,
  'uppercase SHA rejected and redacted',
)

const invalidShaSentinel = 'SENTINEL_INVALID_SHA_MUST_NOT_APPEAR'
expectRedacted(
  () => assertProductionDeployment({ ...validContext, expectedSha: invalidShaSentinel }),
  /full lowercase 40-character hexadecimal commit SHA/,
  invalidShaSentinel,
  'invalid SHA is redacted',
)

expectError(
  () =>
    assertProductionDeployment({
      ...validContext,
      origin: 'https://preview.jpvbootcamp.com',
    }),
  /PRODUCTION-DEPLOY-DENIED.*denied staging origin/,
  'staging origin rejected by deployment policy',
)

console.log('productionPolicy.test.ts passed')
