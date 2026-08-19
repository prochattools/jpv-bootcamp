/**
 * Persist staging Traefik routing labels in Dokploy before each deployment.
 *
 * Root cause: Dokploy's Docker Swarm service is recreated on every deploy.
 * If labelsSwarm=NULL in Dokploy's DB (as with the staging app), the service
 * spec has no Traefik routing labels after redeploy. Manual docker service
 * label-add workarounds are lost on the next deploy.
 *
 * Fix: call application.update with the correct labelsSwarm before calling
 * application.deploy. Dokploy persists labelsSwarm in its DB and applies it
 * to the Docker service spec on every deploy. Traefik's Swarm provider then
 * routes preview.jpvbootcamp.com traffic automatically.
 *
 * Note: Dokploy's domain.update → manageDomain writes to the container's
 * internal /etc/dokploy/traefik/dynamic/ — NOT to the host path that Traefik
 * reads (Traefik mounts from the host, not the Dokploy container). This is why
 * domain.update alone does not fix the routing; labelsSwarm is required.
 *
 * Called before application.deploy in deploy-preview.yml.
 */

import {
  assertStagingRoutingTarget,
  buildApplicationUpdatePayload,
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

async function readApplication(): Promise<unknown> {
  const query = new URLSearchParams({ applicationId: STAGING_DOKPLOY_APPLICATION_ID })
  return request(`/application.one?${query.toString()}`)
}

function assertApplicationRecord(record: unknown): asserts record is { applicationId: string; appName: string } {
  if (
    typeof record !== 'object' ||
    record === null ||
    typeof (record as Record<string, unknown>).applicationId !== 'string'
  ) {
    throw new Error('ROUTING-FAILED: application.one returned unexpected shape')
  }
  const r = record as { applicationId: string }
  if (r.applicationId !== STAGING_DOKPLOY_APPLICATION_ID) {
    throw new Error(
      `ROUTING-FAILED: application record applicationId='${r.applicationId}' does not match '${STAGING_DOKPLOY_APPLICATION_ID}'`,
    )
  }
}

// Step 1: verify the application record exists
const before = await readApplication()
assertApplicationRecord(before)
console.log(JSON.stringify({
  ok: true,
  step: 'application_verified',
  applicationId: STAGING_DOKPLOY_APPLICATION_ID,
}))

// Step 2: set labelsSwarm via application.update — persists in Dokploy's DB
// so every future application.deploy applies the correct Traefik routing labels
const payload = buildApplicationUpdatePayload()
await request('/application.update', {
  method: 'POST',
  body: JSON.stringify(payload),
})

// Step 3: verify labelsSwarm is now set in the DB
const after = await readApplication() as Record<string, unknown>
const labelsSwarm = after.labelsSwarm
if (!labelsSwarm || typeof labelsSwarm !== 'object') {
  throw new Error('ROUTING-FAILED: labelsSwarm was not persisted in Dokploy DB after application.update')
}
const ls = labelsSwarm as Record<string, string>
if (ls['traefik.enable'] !== 'true') {
  throw new Error(`ROUTING-FAILED: traefik.enable not set correctly: got '${ls['traefik.enable']}'`)
}

console.log(JSON.stringify({
  ok: true,
  action: 'routing_labels_persisted',
  applicationId: STAGING_DOKPLOY_APPLICATION_ID,
  mechanism: 'application.update labelsSwarm -> persisted in Dokploy DB -> applied on every application.deploy',
  labelCount: Object.keys(ls).length,
}))
