import assert from 'node:assert/strict'

import {
  readBoundedJsonObject,
  resetAccountActionRouteThrottleForTests,
  routeThrottle,
  sameOriginRequest,
} from '../src/lib/auth/accountActionRouteSafety'

function jsonRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request('https://jpv.local/api/member-password/forgot', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body,
  })
}

async function main(): Promise<void> {
  assert.deepEqual(
    await readBoundedJsonObject(
      new Request('https://jpv.local/api/member-password/forgot', {
        method: 'POST',
        headers: { 'content-type': 'text/plain' },
        body: '{}',
      }),
    ),
    { ok: false, status: 415, error: 'unsupported_media_type' },
  )

  assert.deepEqual(await readBoundedJsonObject(jsonRequest('{')), {
    ok: false,
    status: 400,
    error: 'invalid_request',
  })

  assert.deepEqual(await readBoundedJsonObject(jsonRequest('[]')), {
    ok: false,
    status: 400,
    error: 'invalid_request',
  })

  assert.deepEqual(
    await readBoundedJsonObject(jsonRequest('{}', { 'content-length': '4097' })),
    { ok: false, status: 413, error: 'payload_too_large' },
  )

  assert.deepEqual(await readBoundedJsonObject(jsonRequest(JSON.stringify({ email: 'member@example.com' }))), {
    ok: true,
    body: { email: 'member@example.com' },
  })

  assert.equal(
    sameOriginRequest(
      new Request('https://jpv.local/api/member-profile/email-change/request', {
        method: 'POST',
        headers: { origin: 'https://jpv.local' },
      }),
    ),
    true,
  )
  assert.equal(
    sameOriginRequest(
      new Request('https://jpv.local/api/member-profile/email-change/request', {
        method: 'POST',
        headers: { origin: 'https://evil.example' },
      }),
    ),
    false,
  )
  assert.equal(
    sameOriginRequest(
      new Request('https://jpv.local/api/member-profile/email-change/request', {
        method: 'POST',
        headers: { 'sec-fetch-site': 'cross-site' },
      }),
    ),
    false,
  )

  resetAccountActionRouteThrottleForTests()
  const throttleRequest = new Request('https://jpv.local/api/member-password/forgot', {
    headers: { 'x-forwarded-for': '203.0.113.9' },
  })
  assert.equal(
    routeThrottle(throttleRequest, {
      scope: 'forgot',
      identity: 'Member@Example.com',
      maxAttempts: 2,
      windowMs: 60_000,
      now: 1_000,
    }).allowed,
    true,
  )
  assert.equal(
    routeThrottle(throttleRequest, {
      scope: 'forgot',
      identity: 'member@example.com',
      maxAttempts: 2,
      windowMs: 60_000,
      now: 2_000,
    }).allowed,
    true,
  )
  assert.equal(
    routeThrottle(throttleRequest, {
      scope: 'forgot',
      identity: 'member@example.com',
      maxAttempts: 2,
      windowMs: 60_000,
      now: 3_000,
    }).allowed,
    false,
  )
  assert.equal(
    routeThrottle(throttleRequest, {
      scope: 'forgot',
      identity: 'member@example.com',
      maxAttempts: 2,
      windowMs: 60_000,
      now: 62_000,
    }).allowed,
    true,
  )

  console.log('account_action_route_safety.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
