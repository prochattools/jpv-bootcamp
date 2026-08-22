/**
 * Ensure GHCR registry credentials are ready before each deploy.
 *
 * WHAT THIS SCRIPT DOES:
 * - Logs the current GHCR registry configuration for diagnostics.
 * - If GHCR_PAT is present: updates the stored registry record with the
 *   latest PAT so credentials stay fresh in Dokploy's database.
 * - Always ensures registryId is NOT linked to the application.
 *
 * WHY registryId must remain null:
 * When a registryId is linked, Dokploy's "Enabled Registry Swarm" pipeline
 * activates. It pulls the source image, re-tags it as
 * {registryUrl}/{imagePrefix}/{imageName}:{tag}, then pushes to the registry
 * before running docker service update. This pipeline fails because:
 *   1. The re-tag constructs a doubled namespace path (jpv-bootcamp/jpv-bootcamp).
 *   2. The push step uses Dokploy's internal OAuth token (gho_...), not our PAT,
 *      which lacks write:packages scope.
 *
 * CORRECT DEPLOY PATH (registryId = null):
 * Dokploy runs:  docker service update --image <dockerImage> --with-registry-auth <service>
 * Docker Swarm passes the manager node's Docker daemon credentials to workers.
 * Workers pull from GHCR using those credentials.
 *
 * PREREQUISITE: The Docker daemon on the Swarm manager must be logged in to GHCR.
 * This was done once via SSH:
 *   echo "<PAT>" | sudo docker login ghcr.io -u x-access-token --password-stdin
 * Credentials persist in /root/.docker/config.json until the PAT expires.
 * To refresh: SSH to the Swarm manager (100.71.47.24 via Tailscale) and re-run docker login.
 */

import { assertStagingDokployTarget, STAGING_DOKPLOY_APPLICATION_ID } from './dokployMediaMount'

const appId = process.env.DOKPLOY_PREVIEW_APP_ID?.trim() ?? ''
const apiKey = process.env.DOKPLOY_API_KEY?.trim() ?? ''
const ghcrPat = process.env.GHCR_PAT?.trim() ?? ''
const apiBase = (process.env.DOKPLOY_API_BASE_URL?.trim() || 'https://dokploy.prochat.tools/api').replace(/\/$/, '')

if (!appId) throw new Error('GHCR-CRED-DENIED: DOKPLOY_PREVIEW_APP_ID is required')
if (!apiKey) throw new Error('GHCR-CRED-DENIED: DOKPLOY_API_KEY is required')

assertStagingDokployTarget(appId)

const GHCR_HOST = 'ghcr.io'
const GHCR_REGISTRY_NAME = 'ghcr-prochattools-jpv-bootcamp'
const GHCR_USERNAME = 'x-access-token'

async function dokployRequest(path: string, init?: RequestInit): Promise<unknown> {
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
      throw new Error(`GHCR-CRED-FAILED: Dokploy returned non-JSON HTTP ${response.status}: ${text.slice(0, 200)}`)
    }
  }

  if (!response.ok) {
    throw new Error(`GHCR-CRED-FAILED: Dokploy returned HTTP ${response.status}`)
  }

  return body
}

// Step 1: list all registries to log current state
const allRegistries = await dokployRequest('/registry.all')

type RegistryEntry = { registryId?: unknown; registryName?: unknown; registryUrl?: unknown }
function isRegistryEntry(value: unknown): value is RegistryEntry {
  return typeof value === 'object' && value !== null
}

const registryList = Array.isArray(allRegistries) ? allRegistries : []
const sanitized = registryList.map((r: unknown) => {
  if (!isRegistryEntry(r)) return r
  return { registryId: r.registryId, registryName: r.registryName, registryUrl: r.registryUrl }
})
console.log(JSON.stringify({ ok: true, step: 'registry_list', count: registryList.length, registries: sanitized }))

// Step 2: find existing GHCR registry entry
const existing = registryList.find(
  (r: unknown): r is RegistryEntry =>
    isRegistryEntry(r) &&
    (String(r.registryName) === GHCR_REGISTRY_NAME ||
      String(r.registryUrl) === GHCR_HOST ||
      String(r.registryUrl).includes(GHCR_HOST)),
)

// Step 3: update registry record with latest PAT (for diagnostics / future use)
if (ghcrPat) {
  if (existing && typeof existing.registryId === 'string') {
    await dokployRequest('/registry.update', {
      method: 'POST',
      body: JSON.stringify({
        registryId: existing.registryId,
        registryName: GHCR_REGISTRY_NAME,
        username: GHCR_USERNAME,
        password: ghcrPat,
        imagePrefix: 'prochattools',
        registryUrl: GHCR_HOST,
      }),
    })
    console.log(JSON.stringify({ ok: true, step: 'registry_credentials_updated', registryId: existing.registryId }))
  } else {
    console.log(JSON.stringify({ ok: true, step: 'registry_credentials_skipped', reason: 'no existing registry record found' }))
  }
} else {
  console.log(JSON.stringify({
    ok: false,
    step: 'no_ghcr_pat',
    warning: 'GHCR_PAT secret not set — registry credentials not refreshed. ' +
      'Docker daemon credentials on the Swarm manager should still be valid from the last docker login. ' +
      'If deploys fail with pull errors, SSH to 100.71.47.24 (Tailscale) and run: ' +
      'echo "<PAT>" | sudo docker login ghcr.io -u x-access-token --password-stdin',
  }))
}

// Step 4: always ensure registryId is NOT linked to the application.
// Linking registryId activates Dokploy's "Enabled Registry Swarm" pipeline which
// re-tags and re-pushes the image — this fails due to wrong path construction and
// expired OAuth push token. Direct docker service update is correct for our setup.
await dokployRequest('/application.update', {
  method: 'POST',
  body: JSON.stringify({ applicationId: STAGING_DOKPLOY_APPLICATION_ID, registryId: null }),
})
console.log(JSON.stringify({
  ok: true,
  step: 'registry_link_cleared',
  applicationId: STAGING_DOKPLOY_APPLICATION_ID,
  note: 'registryId always null; Dokploy uses direct docker service update --with-registry-auth',
}))
