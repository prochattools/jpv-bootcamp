/**
 * Ensure GHCR registry credentials are ready before each deploy.
 *
 * DEPLOYMENT BLOCKER DIAGNOSIS (2026-08-20):
 * The Dokploy host's Docker daemon lacks valid GHCR credentials. The
 * image `ghcr.io/prochattools/jpv-bootcamp` is private and requires
 * authentication for Docker pulls.
 *
 * REQUIRED OPERATOR ACTION (one-time setup):
 *   SSH to 68.221.139.108 (the Dokploy host):
 *     docker login ghcr.io -u x-access-token -p <GITHUB_PAT>
 *   where GITHUB_PAT is a GitHub PAT with read:packages scope for
 *   the prochattools org. Then verify:
 *     docker pull ghcr.io/prochattools/jpv-bootcamp:9bd35c08ec393d2d097eb0dbcbfbaa159708ebbf
 *   After success, re-trigger deploy from Dokploy UI or re-run this workflow.
 *
 * WHAT THIS SCRIPT DOES:
 * - Logs the current GHCR registry configuration for diagnostics.
 * - If GHCR_PAT (long-lived PAT) is provided via env: updates the registry
 *   credentials and links registryId to the application (enables Dokploy
 *   to authenticate before docker service update).
 * - If GHCR_PAT is absent: clears any stale registryId link (reverts to
 *   "done" deploy status while awaiting operator one-time docker login).
 *
 * Linker root cause: the short-lived GITHUB_TOKEN (ghs_xxx) fails when
 * Dokploy tries to authenticate from its host server to GHCR. Always use
 * a long-lived PAT stored as GHCR_PAT secret for this credential.
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

if (ghcrPat) {
  // GHCR_PAT present: update/create credentials and link to application
  let registryId: string | null = null

  if (existing && typeof existing.registryId === 'string') {
    registryId = existing.registryId
    await dokployRequest('/registry.update', {
      method: 'POST',
      body: JSON.stringify({ registryId, username: GHCR_USERNAME, password: ghcrPat }),
    })
    console.log(JSON.stringify({ ok: true, step: 'registry_credentials_updated', registryId }))
  } else {
    const created = await dokployRequest('/registry.create', {
      method: 'POST',
      body: JSON.stringify({
        registryName: GHCR_REGISTRY_NAME,
        username: GHCR_USERNAME,
        password: ghcrPat,
        registryUrl: GHCR_HOST,
        imagePrefix: 'prochattools/jpv-bootcamp',
      }),
    })
    if (isRegistryEntry(created) && typeof created.registryId === 'string') {
      registryId = created.registryId
      console.log(JSON.stringify({ ok: true, step: 'registry_created', registryId }))
    } else {
      throw new Error('GHCR-CRED-FAILED: registry.create did not return a registryId')
    }
  }

  await dokployRequest('/application.update', {
    method: 'POST',
    body: JSON.stringify({ applicationId: STAGING_DOKPLOY_APPLICATION_ID, registryId }),
  })
  console.log(JSON.stringify({
    ok: true,
    step: 'registry_linked_to_application',
    applicationId: STAGING_DOKPLOY_APPLICATION_ID,
    registryId,
  }))
} else {
  // GHCR_PAT absent: clear any stale registryId to prevent deploy errors.
  // NOTE: Without a valid registryId, Dokploy won't authenticate explicitly.
  // The deploy will show "done" but Docker pull will fail unless the host
  // daemon already has valid GHCR credentials (from operator docker login).
  console.log(JSON.stringify({
    ok: false,
    step: 'no_ghcr_pat',
    warning: 'GHCR_PAT secret not set. Clearing registryId link to prevent deploy errors. ' +
      'OPERATOR ACTION REQUIRED: SSH to 68.221.139.108 and run: ' +
      'docker login ghcr.io -u x-access-token -p <GITHUB_PAT with read:packages>. ' +
      'Then add GHCR_PAT secret to this repository for automated credential management.',
  }))

  if (existing && typeof existing.registryId === 'string') {
    // Clear the broken registryId link so deploys return to "done" state
    await dokployRequest('/application.update', {
      method: 'POST',
      body: JSON.stringify({ applicationId: STAGING_DOKPLOY_APPLICATION_ID, registryId: null }),
    })
    console.log(JSON.stringify({
      ok: true,
      step: 'registry_link_cleared',
      applicationId: STAGING_DOKPLOY_APPLICATION_ID,
      note: 'registryId set to null; deploys will use host Docker daemon credentials',
    }))
  }
}
