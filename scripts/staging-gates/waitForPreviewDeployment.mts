import { assertStagingOrigin, STAGING_APP_ID } from './stagingPolicy'
import { STAGING_DOKPLOY_APPLICATION_ID } from './dokployMediaMount'

function requireEnvironment(name: 'STAGING_URL' | 'EXPECTED_DEPLOYMENT_SHA' | 'DOKPLOY_API_KEY' | 'DOKPLOY_PREVIEW_APP_ID'): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`DEPLOYMENT-WAIT-DENIED: ${name} is required and must be nonempty`)
  return value
}

const stagingUrl = requireEnvironment('STAGING_URL').replace(/\/$/, '')
const expectedSha = requireEnvironment('EXPECTED_DEPLOYMENT_SHA')
const apiKey = requireEnvironment('DOKPLOY_API_KEY')
const appId = requireEnvironment('DOKPLOY_PREVIEW_APP_ID')
const apiBase = (process.env.DOKPLOY_API_BASE_URL?.trim() || 'https://dokploy.prochat.tools/api').replace(/\/$/, '')

const maximumAttempts = 40
const delayMilliseconds = 15_000
const retriggerAfterAttempt = 10
const forceRedeployAfterAttempt = 25

assertStagingOrigin(stagingUrl)
if (!/^[0-9a-f]{40}$/i.test(expectedSha)) {
  throw new Error('DEPLOYMENT-WAIT-DENIED: EXPECTED_DEPLOYMENT_SHA must be a full 40-character commit SHA')
}

if (appId !== STAGING_APP_ID && appId !== STAGING_DOKPLOY_APPLICATION_ID) {
  throw new Error(`DEPLOYMENT-WAIT-DENIED: DOKPLOY_PREVIEW_APP_ID '${appId}' does not match allowed staging app`)
}

async function dokployRequest(path: string, body: Record<string, unknown>): Promise<{ status: number; data: unknown }> {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  })
  const text = await response.text()
  let data: unknown
  try { data = JSON.parse(text) } catch { data = text.slice(0, 200) }
  return { status: response.status, data }
}

async function retriggerDeploy(): Promise<void> {
  console.log(JSON.stringify({ action: 'retrigger_deploy', reason: 'stale_image_after_initial_polls' }))
  const result = await dokployRequest('/application.deploy', {
    applicationId: appId,
    title: `convergence-retry-${expectedSha.slice(0, 8)}`,
    description: `Re-triggered: swarm did not converge to ${expectedSha} within ${retriggerAfterAttempt * delayMilliseconds / 1000}s`,
  })
  console.log(JSON.stringify({ action: 'retrigger_deploy_result', status: result.status }))
}

async function forceRedeploy(): Promise<void> {
  console.log(JSON.stringify({ action: 'force_redeploy', reason: 'stale_image_after_retrigger' }))

  const updateResult = await dokployRequest('/application.update', {
    applicationId: appId,
    dockerImage: `ghcr.io/prochattools/jpv-bootcamp:${expectedSha}`,
  })
  console.log(JSON.stringify({ action: 'force_image_update', status: updateResult.status }))

  const deployResult = await dokployRequest('/application.deploy', {
    applicationId: appId,
    title: `force-convergence-${expectedSha.slice(0, 8)}`,
    description: `Force redeploy: swarm did not converge after retrigger. Target: ${expectedSha}`,
  })
  console.log(JSON.stringify({ action: 'force_deploy_result', status: deployResult.status }))
}

let retriggered = false
let forceRedeployed = false

for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
  try {
    const response = await fetch(`${stagingUrl}/api/health/deployment`, {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    })

    if (response.ok) {
      const body = (await response.json()) as { imageTag?: unknown }
      const imageTag = typeof body.imageTag === 'string' ? body.imageTag : ''
      if (imageTag === expectedSha) {
        console.log(JSON.stringify({ ok: true, attempt, imageTag, retriggered, forceRedeployed }))
        process.exit(0)
      }
      console.log(JSON.stringify({ ok: false, attempt, status: response.status, imageTag }))
    } else {
      console.log(JSON.stringify({ ok: false, attempt, status: response.status }))
    }
  } catch (error) {
    console.log(
      JSON.stringify({
        ok: false,
        attempt,
        error: error instanceof Error ? error.name : 'UnknownError',
      }),
    )
  }

  if (attempt === retriggerAfterAttempt && !retriggered) {
    retriggered = true
    try { await retriggerDeploy() } catch (e) {
      console.log(JSON.stringify({ action: 'retrigger_error', error: String(e) }))
    }
  }

  if (attempt === forceRedeployAfterAttempt && !forceRedeployed) {
    forceRedeployed = true
    try { await forceRedeploy() } catch (e) {
      console.log(JSON.stringify({ action: 'force_redeploy_error', error: String(e) }))
    }
  }

  if (attempt < maximumAttempts) {
    await new Promise((resolve) => setTimeout(resolve, delayMilliseconds))
  }
}

throw new Error(`DEPLOYMENT-WAIT-FAILED: staging did not serve ${expectedSha} within 10 minutes (retriggered=${retriggered}, forceRedeployed=${forceRedeployed})`)
