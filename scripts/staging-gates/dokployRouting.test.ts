import assert from 'node:assert/strict'
import {
  assertStagingRoutingTarget,
  buildApplicationUpdatePayload,
  STAGING_DOMAIN_ID,
  STAGING_DOMAIN_HOST,
  STAGING_TRAEFIK_LABELS,
  TRAEFIK_FILE_PROVIDER_PATH,
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
assert.equal(STAGING_DOMAIN_HOST, 'staging.jpvbootcamp.com', 'staging domain host')

// --- TRAEFIK_FILE_PROVIDER_PATH: must reference the staging app and correct directory ---
assert.ok(
  TRAEFIK_FILE_PROVIDER_PATH.includes('/etc/dokploy/traefik/dynamic/'),
  'file provider path must be in /etc/dokploy/traefik/dynamic/',
)
assert.ok(
  TRAEFIK_FILE_PROVIDER_PATH.includes('preview-jpvbootcamp'),
  'file provider path must reference preview-jpvbootcamp',
)
assert.ok(
  TRAEFIK_FILE_PROVIDER_PATH.endsWith('.yml'),
  'file provider path must be a .yml file',
)

// --- STAGING_TRAEFIK_LABELS: required routing labels ---
assert.equal(STAGING_TRAEFIK_LABELS['traefik.enable'], 'true', 'traefik.enable=true')
assert.ok(
  Object.keys(STAGING_TRAEFIK_LABELS).some((k) => k.includes('.rule')),
  'labels must include a Host() routing rule',
)
assert.ok(
  Object.values(STAGING_TRAEFIK_LABELS).some((v) => v.includes('staging.jpvbootcamp.com')),
  'labels must reference staging.jpvbootcamp.com',
)
assert.ok(
  Object.keys(STAGING_TRAEFIK_LABELS).some((k) => k.includes('.server.port')),
  'labels must include loadbalancer server port',
)
assert.equal(
  STAGING_TRAEFIK_LABELS['traefik.docker.network'],
  'dokploy-network',
  'labels must include dokploy-network',
)

// --- STAGING_TRAEFIK_LABELS: must not reference production domain ---
for (const v of Object.values(STAGING_TRAEFIK_LABELS)) {
  assert.ok(
    !v.includes('jpvbootcamp.com') || v.includes('staging.jpvbootcamp.com'),
    `label value must not reference production domain: ${v}`,
  )
}

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

// --- buildApplicationUpdatePayload: targets exact staging app ---
const payload = buildApplicationUpdatePayload()
assert.equal(payload.applicationId, STAGING_DOKPLOY_APPLICATION_ID, 'payload applicationId')

// --- buildApplicationUpdatePayload: labelsSwarm is the correct labels ---
const labels = payload.labelsSwarm as Record<string, string>
assert.ok(typeof labels === 'object' && labels !== null, 'labelsSwarm is an object')
assert.equal(labels['traefik.enable'], 'true', 'labelsSwarm traefik.enable')
assert.ok(
  Object.values(labels).some((v) => v.includes('staging.jpvbootcamp.com')),
  'labelsSwarm references staging.jpvbootcamp.com',
)

// --- buildApplicationUpdatePayload: no sensitive keys ---
const sensitiveKeys = ['apiKey', 'password', 'secret', 'token', 'env', 'DATABASE_URL']
for (const key of sensitiveKeys) {
  assert.ok(!(key in payload), `payload must not include sensitive key: ${key}`)
}

// --- buildApplicationUpdatePayload: stable across calls (idempotent) ---
const p1 = buildApplicationUpdatePayload()
const p2 = buildApplicationUpdatePayload()
assert.equal(JSON.stringify(p1), JSON.stringify(p2), 'payload is stable across calls')

console.log('dokployRouting.test.ts passed — 25 assertions')
