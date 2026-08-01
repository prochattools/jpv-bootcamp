import { assertProductionOrigin, PRODUCTION_ORIGIN } from './productionPolicy'

export const DEFAULT_MAX_ATTEMPTS = 40
export const DEFAULT_DELAY_MS = 15_000
export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000

export type FetchLike = (
  url: string,
  init: { cache: string; redirect: string; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>

export type SleepLike = (ms: number) => Promise<void>

export type SignalFactory = (timeoutMs: number) => AbortSignal

export interface WaitOptions {
  productionUrl: string
  expectedSha: string
  maxAttempts?: number
  delayMs?: number
  requestTimeoutMs?: number
  fetch?: FetchLike
  sleep?: SleepLike
  signalFactory?: SignalFactory
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function defaultSignalFactory(ms: number): AbortSignal {
  return AbortSignal.timeout(ms)
}

export async function waitForProductionDeployment(opts: WaitOptions): Promise<void> {
  const {
    productionUrl,
    expectedSha,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    delayMs = DEFAULT_DELAY_MS,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    fetch: fetchImpl = (globalThis as unknown as { fetch: FetchLike }).fetch,
    sleep = defaultSleep,
    signalFactory = defaultSignalFactory,
  } = opts

  // Validate origin before any network call
  const normalizedUrl = productionUrl.replace(/\/$/, '')
  assertProductionOrigin(normalizedUrl)

  // Validate SHA format before any network call
  if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
    throw new Error(
      'PRODUCTION-DEPLOYMENT-WAIT-DENIED: expectedSha must be a full lowercase 40-character hexadecimal commit SHA',
    )
  }

  const endpoint = `${normalizedUrl}/api/health/deployment`

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchImpl(endpoint, {
        cache: 'no-store',
        redirect: 'error',
        signal: signalFactory(requestTimeoutMs),
      })

      if (response.ok) {
        let body: unknown
        try {
          body = await response.json()
        } catch {
          console.log(JSON.stringify({ ok: false, attempt, status: response.status, error: 'MalformedJSON' }))
          body = null
        }
        const imageTag =
          body !== null &&
          typeof body === 'object' &&
          'imageTag' in (body as object) &&
          typeof (body as { imageTag?: unknown }).imageTag === 'string'
            ? (body as { imageTag: string }).imageTag
            : ''

        if (imageTag === expectedSha) {
          console.log(JSON.stringify({ ok: true, attempt, imageTag }))
          return
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

    if (attempt < maxAttempts) {
      await sleep(delayMs)
    }
  }

  throw new Error(
    `PRODUCTION-DEPLOYMENT-WAIT-FAILED: production did not serve ${expectedSha} within the allowed window`,
  )
}

export const PRODUCTION_DEPLOYMENT_ENDPOINT = `${PRODUCTION_ORIGIN}/api/health/deployment`
