/**
 * Ensure staging Traefik routing is intact after every Dokploy deployment.
 *
 * Root cause: Dokploy uses the Traefik file provider for HTTP routing — it writes
 * /etc/dokploy/traefik/dynamic/<appName>.yml via manageDomain(). manageDomain() is
 * only called on domain CREATE or UPDATE, never on application.deploy. If the file
 * is absent or stale, preview.jpvbootcamp.com returns 404.
 *
 * Fix: call domain.update with the staging domain ID (idempotent — sends existing
 * values back unchanged). This triggers manageDomain() in Dokploy, which re-writes
 * the Traefik config file and restores routing without any raw Docker label manipulation.
 *
 * Called after application.deploy in deploy-preview.yml.
 */

import {
  assertStagingRoutingTarget,
  buildDomainUpdatePayload,
  STAGING_DOMAIN_ID,
} from './dokployRouting'
import { STAGING_DOKPLOY_APPLICATION_ID } from './dokployMediaMount'

const appId = process.env.DOKPLOY_PREVIEW_APP_ID?.trim() ?? ''
const apiKey = process.env.DOKPLOY_API_KEY?.trim() ?? ''
const apiBase = (process.env.DOKPLOY_API_BASE_URL?.trim() || 'https://dokploy.prochat.tools/api').replace(/\/$/, '')

if (!appId) throw new Error('ROUTING-DENIED: DOKPLOY_PREVIEW_APP_ID is required')
if (!apiKey) throw new Error('ROUTING-DENIED: DOKPLOY_API_KEY is required')

// Fail closed: verify target before any API call
assertStagingRoutingTarget(STAGING_DOMAIN_ID, appId)

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      ...(init?.headers ?? {}),
    },
    redirect: 'error',
  })

  const text = await response.text()
  let body: unknown = {}
  if (text.trim()) {
    try {
      body = JSON.parse(text)
    } catch {
      throw new Error(`ROUTING-FAILED: Dokploy returned non-JSON HTTP ${response.status}`)
    }
  }

  if (!response.ok) {
    throw new Error(`ROUTING-FAILED: Dokploy returned HTTP ${response.status}`)
  }

  return body
}

async function readDomain(): Promise<unknown> {
  const query = new URLSearchParams({ domainId: STAGING_DOMAIN_ID })
  return request(`/domain.one?${query.toString()}`)
}

function assertDomainRecord(record: unknown): asserts record is { domainId: string; host: string } {
  if (
    typeof record !== 'object' ||
    record === null ||
    typeof (record as Record<string, unknown>).domainId !== 'string' ||
    typeof (record as Record<string, unknown>).host !== 'string'
  ) {
    throw new Error('ROUTING-FAILED: domain.one returned unexpected shape')
  }
  const r = record as { domainId: string; host: string; applicationId?: string }
  if (r.domainId !== STAGING_DOMAIN_ID) {
    throw new Error(
      `ROUTING-FAILED: domain record domainId='${r.domainId}' does not match expected '${STAGING_DOMAIN_ID}'`,
    )
  }
  if (r.host !== 'preview.jpvbootcamp.com') {
    throw new Error(
      `ROUTING-FAILED: domain record host='${r.host}' does not match expected 'preview.jpvbootcamp.com'`,
    )
  }
  if (r.applicationId !== STAGING_DOKPLOY_APPLICATION_ID) {
    throw new Error(
      `ROUTING-FAILED: domain applicationId='${r.applicationId}' does not match staging app '${STAGING_DOKPLOY_APPLICATION_ID}'`,
    )
  }
}

// Step 1: verify the domain record is correct before mutating
const before = await readDomain()
assertDomainRecord(before)
console.log(JSON.stringify({ ok: true, step: 'domain_verified', domainId: STAGING_DOMAIN_ID, host: 'preview.jpvbootcamp.com' }))

// Step 2: call domain.update — triggers manageDomain() in Dokploy, which re-writes
// the Traefik file provider config at /etc/dokploy/traefik/dynamic/<appName>.yml
const payload = buildDomainUpdatePayload()
await request('/domain.update', {
  method: 'POST',
  body: JSON.stringify(payload),
})

// Step 3: verify domain record is intact after update
const after = await readDomain()
assertDomainRecord(after)

console.log(JSON.stringify({
  ok: true,
  action: 'routing_restored',
  domainId: STAGING_DOMAIN_ID,
  host: 'preview.jpvbootcamp.com',
  mechanism: 'domain.update triggers manageDomain() -> Traefik file provider config rewritten',
}))
