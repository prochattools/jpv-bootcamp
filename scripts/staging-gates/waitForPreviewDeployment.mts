import { assertStagingOrigin } from './stagingPolicy'

function requireEnvironment(name: 'STAGING_URL' | 'EXPECTED_DEPLOYMENT_SHA'): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`DEPLOYMENT-WAIT-DENIED: ${name} is required and must be nonempty`)
  return value
}

const stagingUrl = requireEnvironment('STAGING_URL').replace(/\/$/, '')
const expectedSha = requireEnvironment('EXPECTED_DEPLOYMENT_SHA')
const maximumAttempts = 40
const delayMilliseconds = 15_000

assertStagingOrigin(stagingUrl)
if (!/^[0-9a-f]{40}$/i.test(expectedSha)) {
  throw new Error('DEPLOYMENT-WAIT-DENIED: EXPECTED_DEPLOYMENT_SHA must be a full 40-character commit SHA')
}

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
        console.log(JSON.stringify({ ok: true, attempt, imageTag }))
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

  if (attempt < maximumAttempts) {
    await new Promise((resolve) => setTimeout(resolve, delayMilliseconds))
  }
}

throw new Error(`DEPLOYMENT-WAIT-FAILED: staging did not serve ${expectedSha} within 10 minutes`)
