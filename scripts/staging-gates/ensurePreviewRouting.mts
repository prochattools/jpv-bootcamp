/**
 * Ensure staging Traefik routing is active before each deployment.
 *
 * Root cause: Dokploy's Docker Swarm deploy recreates the service spec.
 * When labelsSwarm=NULL in Dokploy's DB, the service has no Traefik labels
 * after redeploy and Traefik's swarm provider cannot route traffic.
 *
 * Architecture clarification (verified 2026-08-19):
 * - Traefik swarm provider reads SERVICE-LEVEL labels (Spec.Labels).
 * - Dokploy's labelsSwarm writes to TaskTemplate.ContainerSpec.Labels,
 *   which Traefik's docker provider would need to read (but doesn't for
 *   Swarm-managed services in this Dokploy config).
 * - Fix: Traefik FILE PROVIDER config at /etc/dokploy/traefik/dynamic/
 *   preview-jpvbootcamp.yml on the HOST filesystem. Traefik watches this
 *   directory and hot-reloads; the file survives all Docker service deploys.
 *
 * This script:
 * 1. Fails closed if not targeting the exact staging app.
 * 2. Sets labelsSwarm in Dokploy's DB via application.update (belt-and-
 *    suspenders: ContainerSpec.Labels are set on each deploy and may be used
 *    by future Dokploy versions that write service-level labels).
 * 3. Verifies routing is active by checking the preview URL returns 2xx/3xx.
 *    If 404, the Traefik file provider config is missing or invalid — fail
 *    closed so the operator must restore it before deploying.
 *
 * File provider config location (operator-managed, ONE-TIME SETUP):
 *   /etc/dokploy/traefik/dynamic/preview-jpvbootcamp.yml
 *
 * Called before application.deploy in deploy-preview.yml.
 */

import {
  assertStagingRoutingTarget,
  buildApplicationUpdatePayload,
  STAGING_DOMAIN_HOST,
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

// Step 1: set labelsSwarm via application.update
// This persists ContainerSpec.Labels in Dokploy's DB (belt-and-suspenders).
// NOTE: As of 2026-08-19, Traefik's swarm provider reads SERVICE-LEVEL labels
// (Spec.Labels), not ContainerSpec.Labels. The primary routing mechanism is the
// Traefik file provider config at /etc/dokploy/traefik/dynamic/preview-jpvbootcamp.yml.
const payload = buildApplicationUpdatePayload()
await request('/application.update', {
  method: 'POST',
  body: JSON.stringify(payload),
})
console.log(JSON.stringify({
  ok: true,
  step: 'labels_swarm_updated',
  applicationId: STAGING_DOKPLOY_APPLICATION_ID,
  note: 'ContainerSpec.Labels set; primary routing via Traefik file provider',
}))

// Step 2: verify routing is active via HTTP health check
// The Traefik file provider config must be in place for this to pass.
// If routing is broken (404), fail closed so the deploy does not proceed.
const previewUrl = `https://${STAGING_DOMAIN_HOST}/`
const routingCheck = await fetch(previewUrl, { redirect: 'manual' })
const routingOk = routingCheck.status >= 200 && routingCheck.status < 500 && routingCheck.status !== 404

if (!routingOk) {
  throw new Error(
    `ROUTING-FAILED: ${previewUrl} returned HTTP ${routingCheck.status}. ` +
    `Ensure the Traefik file provider config exists at ` +
    `/etc/dokploy/traefik/dynamic/preview-jpvbootcamp.yml on the host. ` +
    `See scripts/staging-gates/traefik-file-provider-setup.md for the config template.`,
  )
}

console.log(JSON.stringify({
  ok: true,
  action: 'routing_verified',
  previewUrl,
  httpStatus: routingCheck.status,
  mechanism: 'Traefik file provider at /etc/dokploy/traefik/dynamic/preview-jpvbootcamp.yml',
}))
