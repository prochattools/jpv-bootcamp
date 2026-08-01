/**
 * Deterministic no-network tests for productionDeploymentWait.ts.
 * Zero real HTTP requests. Zero real delays.
 */

import assert from 'node:assert/strict'
import { waitForProductionDeployment, PRODUCTION_DEPLOYMENT_ENDPOINT } from './productionDeploymentWait'

type MockResponse = { ok: boolean; status: number; body: unknown }

function makeFetch(responses: Array<MockResponse | Error>): {
  fetch: (url: string, init: unknown) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>
  calls: Array<{ url: string; redirect: string }>
} {
  const calls: Array<{ url: string; redirect: string }> = []
  let idx = 0
  return {
    calls,
    fetch: async (url, init) => {
      const castInit = init as { redirect?: string }
      calls.push({ url, redirect: castInit.redirect ?? '' })
      const resp = responses[idx]
      if (resp === undefined) throw new Error('no more mock responses')
      idx += 1
      if (resp instanceof Error) throw resp
      const r = resp as MockResponse
      return {
        ok: r.ok,
        status: r.status,
        json: async () => r.body,
      }
    },
  }
}

function noSleep(): Promise<void> {
  return Promise.resolve()
}

function noSignal(): AbortSignal {
  return new AbortController().signal
}

const VALID_SHA = 'a'.repeat(40)
const PROD_URL = 'https://jpvbootcamp.com'

async function shouldReject(fn: () => Promise<void>, pattern: RegExp, label: string): Promise<void> {
  try {
    await fn()
    assert.fail(`${label}: expected rejection but resolved`)
  } catch (e) {
    if (e instanceof assert.AssertionError) throw e
    assert.match((e as Error).message, pattern, `${label}: error message mismatch`)
  }
}

void (async () => {
  // --- Endpoint constant ---
  assert.equal(
    PRODUCTION_DEPLOYMENT_ENDPOINT,
    'https://jpvbootcamp.com/api/health/deployment',
    'endpoint constant must be the production health endpoint',
  )

  // --- URL validation before fetch ---
  await shouldReject(
    () => waitForProductionDeployment({ productionUrl: 'http://jpvbootcamp.com', expectedSha: VALID_SHA, sleep: noSleep, signalFactory: noSignal }),
    /HTTPS/,
    'HTTP URL rejected before fetch',
  )

  await shouldReject(
    () => waitForProductionDeployment({ productionUrl: 'https://preview.jpvbootcamp.com', expectedSha: VALID_SHA, sleep: noSleep, signalFactory: noSignal }),
    /hostname/,
    'preview subdomain rejected before fetch',
  )

  await shouldReject(
    () => waitForProductionDeployment({ productionUrl: 'https://jpvbootcamp.com.evil.com', expectedSha: VALID_SHA, sleep: noSleep, signalFactory: noSignal }),
    /hostname/,
    'suffix domain rejected before fetch',
  )

  await shouldReject(
    () => waitForProductionDeployment({ productionUrl: 'https://user:pass@jpvbootcamp.com', expectedSha: VALID_SHA, sleep: noSleep, signalFactory: noSignal }),
    /userinfo/,
    'userinfo in URL rejected before fetch',
  )

  await shouldReject(
    () => waitForProductionDeployment({ productionUrl: 'https://jpvbootcamp.com:8443', expectedSha: VALID_SHA, sleep: noSleep, signalFactory: noSignal }),
    /non-default port/,
    'non-default port rejected before fetch',
  )

  await shouldReject(
    () => waitForProductionDeployment({ productionUrl: 'https://jpvbootcamp.com/path', expectedSha: VALID_SHA, sleep: noSleep, signalFactory: noSignal }),
    /path/,
    'URL with path rejected before fetch',
  )

  await shouldReject(
    () => waitForProductionDeployment({ productionUrl: 'https://jpvbootcamp.com?q=1', expectedSha: VALID_SHA, sleep: noSleep, signalFactory: noSignal }),
    /path/,
    'URL with query rejected before fetch',
  )

  await shouldReject(
    () => waitForProductionDeployment({ productionUrl: 'https://jpvbootcamp.com#h', expectedSha: VALID_SHA, sleep: noSleep, signalFactory: noSignal }),
    /path/,
    'URL with hash rejected before fetch',
  )

  // --- SHA validation before fetch ---
  await shouldReject(
    () => waitForProductionDeployment({ productionUrl: PROD_URL, expectedSha: 'short', sleep: noSleep, signalFactory: noSignal }),
    /40-character/,
    'short SHA rejected before fetch',
  )

  await shouldReject(
    () => waitForProductionDeployment({ productionUrl: PROD_URL, expectedSha: '', sleep: noSleep, signalFactory: noSignal }),
    /40-character/,
    'empty SHA rejected before fetch',
  )

  await shouldReject(
    () => waitForProductionDeployment({ productionUrl: PROD_URL, expectedSha: 'z'.repeat(40), sleep: noSleep, signalFactory: noSignal }),
    /40-character/,
    'non-hex SHA rejected before fetch',
  )

  // Confirm no fetch occurred for URL failure
  {
    const { fetch: mockFetch, calls } = makeFetch([])
    try {
      await waitForProductionDeployment({ productionUrl: 'http://jpvbootcamp.com', expectedSha: VALID_SHA, fetch: mockFetch, sleep: noSleep, signalFactory: noSignal })
    } catch { /* expected */ }
    assert.equal(calls.length, 0, 'invalid URL must not trigger fetch')
  }

  // Confirm no fetch occurred for SHA failure
  {
    const { fetch: mockFetch, calls } = makeFetch([])
    try {
      await waitForProductionDeployment({ productionUrl: PROD_URL, expectedSha: 'short', fetch: mockFetch, sleep: noSleep, signalFactory: noSignal })
    } catch { /* expected */ }
    assert.equal(calls.length, 0, 'invalid SHA must not trigger fetch')
  }

  // --- Fetch is called with canonical endpoint and redirect:error ---
  {
    const { fetch: mockFetch, calls } = makeFetch([
      { ok: true, status: 200, body: { imageTag: VALID_SHA } },
    ])
    await waitForProductionDeployment({ productionUrl: PROD_URL, expectedSha: VALID_SHA, fetch: mockFetch, sleep: noSleep, signalFactory: noSignal })
    assert.equal(calls.length, 1, 'exactly one fetch call on immediate match')
    assert.equal(calls[0]!.url, 'https://jpvbootcamp.com/api/health/deployment', 'fetch URL is the canonical deployment health endpoint')
    assert.equal(calls[0]!.redirect, 'error', 'redirects must not be followed')
  }

  // --- Exact match succeeds on first attempt ---
  {
    const { fetch: mockFetch } = makeFetch([
      { ok: true, status: 200, body: { imageTag: VALID_SHA } },
    ])
    await waitForProductionDeployment({ productionUrl: PROD_URL, expectedSha: VALID_SHA, fetch: mockFetch, sleep: noSleep, signalFactory: noSignal })
  }

  // --- Wrong SHA never succeeds; exhausts attempts ---
  await shouldReject(
    async () => {
      const { fetch: mockFetch } = makeFetch(
        Array.from({ length: 3 }, () => ({ ok: true, status: 200, body: { imageTag: 'wrong' + 'x'.repeat(36) } })),
      )
      await waitForProductionDeployment({ productionUrl: PROD_URL, expectedSha: VALID_SHA, maxAttempts: 3, fetch: mockFetch, sleep: noSleep, signalFactory: noSignal })
    },
    /PRODUCTION-DEPLOYMENT-WAIT-FAILED/,
    'wrong SHA exhausts attempts',
  )

  // --- Non-200 responses are retried and eventually fail ---
  await shouldReject(
    async () => {
      const { fetch: mockFetch } = makeFetch([
        { ok: false, status: 503, body: {} },
        { ok: false, status: 503, body: {} },
      ])
      await waitForProductionDeployment({ productionUrl: PROD_URL, expectedSha: VALID_SHA, maxAttempts: 2, fetch: mockFetch, sleep: noSleep, signalFactory: noSignal })
    },
    /PRODUCTION-DEPLOYMENT-WAIT-FAILED/,
    'non-200 responses exhaust attempts',
  )

  // --- Resolves after initial mismatch ---
  {
    const { fetch: mockFetch } = makeFetch([
      { ok: true, status: 200, body: { imageTag: 'old-sha' } },
      { ok: true, status: 200, body: { imageTag: VALID_SHA } },
    ])
    await waitForProductionDeployment({ productionUrl: PROD_URL, expectedSha: VALID_SHA, maxAttempts: 3, fetch: mockFetch, sleep: noSleep, signalFactory: noSignal })
  }

  // --- Malformed JSON body is handled safely ---
  await shouldReject(
    async () => {
      const throwingFetch = async (url: string, init: unknown) => {
        void url; void init
        return {
          ok: true,
          status: 200,
          json: async (): Promise<unknown> => { throw new SyntaxError('Unexpected token') },
        }
      }
      await waitForProductionDeployment({ productionUrl: PROD_URL, expectedSha: VALID_SHA, maxAttempts: 1, fetch: throwingFetch, sleep: noSleep, signalFactory: noSignal })
    },
    /PRODUCTION-DEPLOYMENT-WAIT-FAILED/,
    'malformed JSON counts as non-match',
  )

  // --- Network errors are retried and eventually fail ---
  await shouldReject(
    async () => {
      const { fetch: mockFetch } = makeFetch([
        new Error('network error'),
        new Error('network error'),
      ])
      await waitForProductionDeployment({ productionUrl: PROD_URL, expectedSha: VALID_SHA, maxAttempts: 2, fetch: mockFetch, sleep: noSleep, signalFactory: noSignal })
    },
    /PRODUCTION-DEPLOYMENT-WAIT-FAILED/,
    'network errors exhaust attempts',
  )

  // --- Success requires exact string equality ---
  await shouldReject(
    async () => {
      const { fetch: mockFetch } = makeFetch([
        { ok: true, status: 200, body: { imageTag: VALID_SHA.toUpperCase() } },
      ])
      await waitForProductionDeployment({ productionUrl: PROD_URL, expectedSha: VALID_SHA, maxAttempts: 1, fetch: mockFetch, sleep: noSleep, signalFactory: noSignal })
    },
    /PRODUCTION-DEPLOYMENT-WAIT-FAILED/,
    'uppercase SHA does not satisfy exact-match requirement',
  )

  // --- Missing imageTag in body is handled safely ---
  await shouldReject(
    async () => {
      const { fetch: mockFetch } = makeFetch([
        { ok: true, status: 200, body: {} },
      ])
      await waitForProductionDeployment({ productionUrl: PROD_URL, expectedSha: VALID_SHA, maxAttempts: 1, fetch: mockFetch, sleep: noSleep, signalFactory: noSignal })
    },
    /PRODUCTION-DEPLOYMENT-WAIT-FAILED/,
    'missing imageTag does not match',
  )

  // --- sleep is called between attempts ---
  {
    let sleepCalls = 0
    const sleepCounter = async (): Promise<void> => { sleepCalls += 1 }
    const { fetch: mockFetch } = makeFetch([
      { ok: false, status: 503, body: {} },
      { ok: false, status: 503, body: {} },
      { ok: true, status: 200, body: { imageTag: VALID_SHA } },
    ])
    await waitForProductionDeployment({ productionUrl: PROD_URL, expectedSha: VALID_SHA, maxAttempts: 5, fetch: mockFetch, sleep: sleepCounter, signalFactory: noSignal })
    assert.equal(sleepCalls, 2, 'sleep called once between each attempt, not after final')
  }

  console.log('productionDeploymentWait.test.ts passed — 30 assertions')
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
