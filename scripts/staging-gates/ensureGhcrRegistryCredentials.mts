/**
 * Ensure Dokploy has fresh GHCR credentials before each deploy.
 *
 * Root cause for stalled deploys (observed 2026-08-20): Dokploy's
 * `application.deploy` returns HTTP 200 immediately, but the async Docker
 * pull silently fails when the stored GHCR credentials are expired or
 * missing. The existing container keeps running unchanged.
 *
 * Fix: before every deploy, upsert a GHCR registry entry in Dokploy's DB
 * using the job's GITHUB_TOKEN (valid for the full workflow run), then link
 * the registry to the staging application. Dokploy passes `--with-registry-auth`
 * when updating the Swarm service, so the fresh token is used for the pull.
 *
 * Called from deploy-preview.yml before "Trigger Dokploy redeploy".
 */

import { assertStagingDokployTarget, STAGING_DOKPLOY_APPLICATION_ID } from './dokployMediaMount'

const appId = process.env.DOKPLOY_PREVIEW_APP_ID?.trim() ?? ''
const apiKey = process.env.DOKPLOY_API_KEY?.trim() ?? ''
const githubToken = process.env.GITHUB_TOKEN_LOGIN?.trim() ?? ''
const apiBase = (process.env.DOKPLOY_API_BASE_URL?.trim() || 'https://dokploy.prochat.tools/api').replace(/\/$/, '')

if (!appId) throw new Error('GHCR-CRED-DENIED: DOKPLOY_PREVIEW_APP_ID is required')
if (!apiKey) throw new Error('GHCR-CRED-DENIED: DOKPLOY_API_KEY is required')
if (!githubToken) throw new Error('GHCR-CRED-DENIED: GITHUB_TOKEN_LOGIN is required')

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

// Step 1: list all registries to find existing GHCR entry
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

let registryId: string | null = null

if (existing && typeof existing.registryId === 'string') {
  // Step 3a: update existing registry credentials
  registryId = existing.registryId
  await dokployRequest('/registry.update', {
    method: 'POST',
    body: JSON.stringify({
      registryId,
      username: GHCR_USERNAME,
      password: githubToken,
    }),
  })
  console.log(JSON.stringify({ ok: true, step: 'registry_credentials_updated', registryId }))
} else {
  // Step 3b: create GHCR registry entry
  const created = await dokployRequest('/registry.create', {
    method: 'POST',
    body: JSON.stringify({
      registryName: GHCR_REGISTRY_NAME,
      username: GHCR_USERNAME,
      password: githubToken,
      registryUrl: GHCR_HOST,
      imagePrefix: 'prochattools/jpv-bootcamp',
    }),
  })
  if (isRegistryEntry(created) && typeof created.registryId === 'string') {
    registryId = created.registryId
    console.log(JSON.stringify({ ok: true, step: 'registry_created', registryId }))
  } else {
    console.log(JSON.stringify({ ok: false, step: 'registry_create_response', created }))
    throw new Error('GHCR-CRED-FAILED: registry.create did not return a registryId')
  }
}

// Step 4: link registry to staging application
await dokployRequest('/application.update', {
  method: 'POST',
  body: JSON.stringify({
    applicationId: STAGING_DOKPLOY_APPLICATION_ID,
    registryId,
  }),
})
console.log(JSON.stringify({
  ok: true,
  step: 'registry_linked_to_application',
  applicationId: STAGING_DOKPLOY_APPLICATION_ID,
  registryId,
}))
