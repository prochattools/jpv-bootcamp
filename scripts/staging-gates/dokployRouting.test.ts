import assert from 'node:assert/strict'
import {
  assertStagingRoutingTarget,
  buildDomainUpdatePayload,
  STAGING_DOMAIN_ID,
  STAGING_DOMAIN_HOST,
} from './dokployRouting'
import { STAGING_APP_ID, PRODUCTION_DENY_LIST } from './stagingPolicy'
import { STAGING_DOKPLOY_APPLICATION_ID } from './dokployMediaMount'

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
assert.equal(STAGING_DOMAIN_ID, 'lLeympWtBHVcL6R9JeyZQ', 'staging domain ID')
assert.equal(STAGING_DOMAIN_HOST, 'preview.jpvbootcamp.com', 'staging domain host')

// --- assertStagingRoutingTarget: valid ---
assertStagingRoutingTarget(STAGING_DOMAIN_ID, STAGING_APP_ID)
assertStagingRoutingTarget(STAGING_DOMAIN_ID, STAGING_DOKPLOY_APPLICATION_ID)

// --- assertStagingRoutingTarget: rejects wrong domainId ---
throws(
  () => assertStagingRoutingTarget('wrong-domain-id', STAGING_APP_ID),
  /ROUTING-DENIED/,
  'wrong domainId blocked',
)

// --- assertStagingRoutingTarget: rejects empty domainId ---
throws(
  () => assertStagingRoutingTarget('', STAGING_APP_ID),
  /ROUTING-DENIED/,
  'empty domainId blocked',
)

// --- assertStagingRoutingTarget: rejects wrong appId ---
throws(
  () => assertStagingRoutingTarget(STAGING_DOMAIN_ID, 'some-other-app'),
  /ROUTING-DENIED/,
  'wrong appId blocked',
)

// --- assertStagingRoutingTarget: rejects empty appId ---
throws(
  () => assertStagingRoutingTarget(STAGING_DOMAIN_ID, ''),
  /ROUTING-DENIED/,
  'empty appId blocked',
)

// --- assertStagingRoutingTarget: rejects production appIds from deny-list ---
for (const deniedId of PRODUCTION_DENY_LIST) {
  throws(
    () => assertStagingRoutingTarget(STAGING_DOMAIN_ID, deniedId),
    /ROUTING-DENIED/,
    `production appId '${deniedId}' blocked`,
  )
}

// --- buildDomainUpdatePayload: content ---
const payload = buildDomainUpdatePayload()
assert.equal(payload.domainId, STAGING_DOMAIN_ID, 'payload domainId')
assert.equal(payload.host, STAGING_DOMAIN_HOST, 'payload host')
assert.equal(payload.https, false, 'payload https=false')
assert.equal(payload.certificateType, 'none', 'payload certificateType=none')

// --- buildDomainUpdatePayload: no sensitive keys ---
const sensitiveKeys = ['applicationId', 'apiKey', 'password', 'secret', 'token']
for (const key of sensitiveKeys) {
  assert.ok(!(key in payload), `payload must not include sensitive key: ${key}`)
}

// --- buildDomainUpdatePayload: stable across calls (idempotent) ---
const p1 = buildDomainUpdatePayload()
const p2 = buildDomainUpdatePayload()
assert.equal(JSON.stringify(p1), JSON.stringify(p2), 'payload is stable across calls')

console.log('dokployRouting.test.ts passed — 16 assertions')
