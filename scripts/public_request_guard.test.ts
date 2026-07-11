import assert from 'node:assert/strict'

import {
  DEFAULT_PUBLIC_REQUEST_MAX_BYTES,
  InMemoryPublicRequestRateLimiter,
  guardPublicRequest,
  redactIp,
  resolvePublicRequestIp,
  sanitizePublicRedirect,
  type PublicRequestGuardLog,
  type PublicRequestRateLimiter,
} from '../src/lib/publicRequestGuard'

const applicationOrigin = 'https://jpv.example'
const baseUrl = `${applicationOrigin}/api/test`

const schema = {
  email: { type: 'email', required: true, maxLength: 320 },
  name: { type: 'string', required: true, minLength: 2, maxLength: 40 },
  source: { type: 'enum', values: ['site', 'partner'] as const },
  next: { type: 'redirect', fallback: '/portal' },
} as const

function jsonRequest(
  body: string,
  options: {
    method?: string
    origin?: string | null
    contentType?: string
    headers?: Record<string, string>
  } = {},
): Request {
  const headers = new Headers({
    'content-type': options.contentType ?? 'application/json',
    ...(options.headers ?? {}),
  })
  if (options.origin !== null) headers.set('origin', options.origin ?? applicationOrigin)
  return new Request(baseUrl, {
    method: options.method ?? 'POST',
    headers,
    body,
  })
}

function baseOptions(overrides: Record<string, unknown> = {}) {
  return {
    namespace: 'public-test',
    methods: ['POST'],
    bodyType: 'json' as const,
    fields: schema,
    applicationOrigin,
    missingOrigin: 'reject' as const,
    ...overrides,
  }
}

async function testMethodAndContentType(): Promise<void> {
  const rejectedMethod = await guardPublicRequest(
    jsonRequest('{}', { method: 'PUT' }),
    baseOptions(),
  )
  assert.deepEqual(rejectedMethod, {
    ok: false,
    code: 'method_not_allowed',
    status: 405,
  })

  const rejectedContentType = await guardPublicRequest(
    jsonRequest('{}', { contentType: 'text/plain' }),
    baseOptions(),
  )
  assert.deepEqual(rejectedContentType, {
    ok: false,
    code: 'unsupported_media_type',
    status: 415,
  })

  const acceptedVendorJson = await guardPublicRequest(
    jsonRequest(JSON.stringify({ email: 'a@example.com', name: 'Ada' }), {
      contentType: 'application/vnd.jpv+json; charset=utf-8',
    }),
    baseOptions(),
  )
  assert.equal(acceptedVendorJson.ok, true)
}

async function testBodyLimitsAndMalformedInput(): Promise<void> {
  const exactBody = JSON.stringify({ email: 'a@example.com', name: 'Ada' })
  const exactBytes = new TextEncoder().encode(exactBody).byteLength
  const exact = await guardPublicRequest(
    jsonRequest(exactBody, { headers: { 'content-length': String(exactBytes) } }),
    baseOptions({ maxBytes: exactBytes }),
  )
  assert.equal(exact.ok, true)

  const over = await guardPublicRequest(
    jsonRequest(exactBody, { headers: { 'content-length': String(exactBytes + 1) } }),
    baseOptions({ maxBytes: exactBytes }),
  )
  assert.deepEqual(over, { ok: false, code: 'payload_too_large', status: 413 })

  const malformedJson = await guardPublicRequest(jsonRequest('{'), baseOptions())
  assert.deepEqual(malformedJson, { ok: false, code: 'malformed_body', status: 400 })

  const malformedForm = await guardPublicRequest(
    new Request(baseUrl, {
      method: 'POST',
      headers: {
        origin: applicationOrigin,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'email=a%40example.com&email=b%40example.com&name=Ada',
    }),
    {
      ...baseOptions(),
      bodyType: 'form',
    },
  )
  assert.deepEqual(malformedForm, {
    ok: false,
    code: 'field_nested',
    status: 400,
    field: 'email',
  })

  assert.equal(DEFAULT_PUBLIC_REQUEST_MAX_BYTES, 8192)
}

async function testOriginPolicy(): Promise<void> {
  const body = JSON.stringify({ email: 'a@example.com', name: 'Ada' })
  const sameOrigin = await guardPublicRequest(jsonRequest(body), baseOptions())
  assert.equal(sameOrigin.ok, true)

  const crossOrigin = await guardPublicRequest(
    jsonRequest(body, { origin: 'https://evil.example' }),
    baseOptions(),
  )
  assert.deepEqual(crossOrigin, { ok: false, code: 'origin_forbidden', status: 403 })

  const opaque = await guardPublicRequest(
    jsonRequest(body, { origin: 'null' }),
    baseOptions(),
  )
  assert.deepEqual(opaque, { ok: false, code: 'origin_invalid', status: 403 })

  const malformed = await guardPublicRequest(
    jsonRequest(body, { origin: 'not a url' }),
    baseOptions(),
  )
  assert.deepEqual(malformed, { ok: false, code: 'origin_invalid', status: 403 })

  const missingRejected = await guardPublicRequest(
    jsonRequest(body, { origin: null }),
    baseOptions(),
  )
  assert.deepEqual(missingRejected, { ok: false, code: 'origin_required', status: 403 })

  const missingAllowed = await guardPublicRequest(
    jsonRequest(body, { origin: null }),
    baseOptions({ missingOrigin: 'allow' }),
  )
  assert.equal(missingAllowed.ok, true)

  const fetchCrossSite = await guardPublicRequest(
    jsonRequest(body, { headers: { 'sec-fetch-site': 'cross-site' } }),
    baseOptions(),
  )
  assert.deepEqual(fetchCrossSite, {
    ok: false,
    code: 'origin_forbidden',
    status: 403,
  })
}

async function testFieldPolicy(): Promise<void> {
  const missing = await guardPublicRequest(
    jsonRequest(JSON.stringify({ email: 'a@example.com' })),
    baseOptions(),
  )
  assert.deepEqual(missing, {
    ok: false,
    code: 'field_required',
    status: 400,
    field: 'name',
  })

  const optional = await guardPublicRequest(
    jsonRequest(JSON.stringify({ email: 'A@EXAMPLE.COM ', name: ' Ada ' })),
    baseOptions(),
  )
  assert.equal(optional.ok, true)
  if (optional.ok) {
    assert.deepEqual(optional.data, {
      email: 'a@example.com',
      name: 'Ada',
      source: undefined,
      next: undefined,
    })
  }

  const tooLong = await guardPublicRequest(
    jsonRequest(JSON.stringify({ email: 'a@example.com', name: 'x'.repeat(41) })),
    baseOptions(),
  )
  assert.deepEqual(tooLong, {
    ok: false,
    code: 'field_too_long',
    status: 400,
    field: 'name',
  })

  const invalidEnum = await guardPublicRequest(
    jsonRequest(JSON.stringify({ email: 'a@example.com', name: 'Ada', source: 'bad' })),
    baseOptions(),
  )
  assert.deepEqual(invalidEnum, {
    ok: false,
    code: 'field_invalid',
    status: 400,
    field: 'source',
  })

  const unknown = await guardPublicRequest(
    jsonRequest(JSON.stringify({ email: 'a@example.com', name: 'Ada', extraField: 'ignored' })),
    baseOptions(),
  )
  assert.deepEqual(unknown, {
    ok: false,
    code: 'field_unknown',
    status: 400,
    field: 'extraField',
  })

  const nested = await guardPublicRequest(
    jsonRequest(JSON.stringify({ email: 'a@example.com', name: { first: 'Ada' } })),
    baseOptions(),
  )
  assert.deepEqual(nested, {
    ok: false,
    code: 'field_nested',
    status: 400,
    field: 'name',
  })
}

function testRedirectPolicy(): void {
  assert.equal(
    sanitizePublicRedirect({ value: '/portal/billing?x=1', fallback: '/portal' }),
    '/portal/billing?x=1',
  )
  assert.equal(
    sanitizePublicRedirect({ value: 'https://evil.example', fallback: '/portal' }),
    '/portal',
  )
  assert.equal(
    sanitizePublicRedirect({ value: '//evil.example/path', fallback: '/portal' }),
    '/portal',
  )
  assert.equal(
    sanitizePublicRedirect({ value: '/%2f%2fevil.example', fallback: '/portal' }),
    '/portal',
  )
  assert.equal(
    sanitizePublicRedirect({
      value: 'https://jpv.example/portal',
      fallback: '/portal',
      applicationOrigin,
      allowApplicationOriginUrl: true,
    }),
    '/portal',
  )
}

async function testRateLimitingAndNamespaces(): Promise<void> {
  const limiter = new InMemoryPublicRequestRateLimiter()
  const rateOptions = {
    limiter,
    limit: 1,
    windowMs: 60_000,
    identityField: 'email' as const,
    backendFailure: 'deny' as const,
  }
  const body = JSON.stringify({ email: 'a@example.com', name: 'Ada' })
  const request = () =>
    jsonRequest(body, { headers: { 'x-forwarded-for': '203.0.113.9' } })

  const allowed = await guardPublicRequest(
    request(),
    baseOptions({ trustProxyHeaders: true, rateLimit: rateOptions, now: 1000 }),
  )
  assert.equal(allowed.ok, true)

  const denied = await guardPublicRequest(
    request(),
    baseOptions({ trustProxyHeaders: true, rateLimit: rateOptions, now: 2000 }),
  )
  assert.deepEqual(denied, {
    ok: false,
    code: 'rate_limited',
    status: 429,
    retryAfterSeconds: 59,
  })

  const otherNamespace = await guardPublicRequest(
    request(),
    baseOptions({
      namespace: 'public-other',
      trustProxyHeaders: true,
      rateLimit: rateOptions,
      now: 2000,
    }),
  )
  assert.equal(otherNamespace.ok, true)

  const unavailableLimiter: PublicRequestRateLimiter = {
    consume() {
      throw new Error('backend unavailable')
    },
  }
  const failClosed = await guardPublicRequest(
    request(),
    baseOptions({
      rateLimit: { ...rateOptions, limiter: unavailableLimiter, backendFailure: 'deny' },
    }),
  )
  assert.deepEqual(failClosed, {
    ok: false,
    code: 'rate_limit_unavailable',
    status: 503,
  })

  const failOpen = await guardPublicRequest(
    request(),
    baseOptions({
      rateLimit: { ...rateOptions, limiter: unavailableLimiter, backendFailure: 'allow' },
    }),
  )
  assert.equal(failOpen.ok, true)
}

function testTrustedProxyPolicy(): void {
  const request = new Request(baseUrl, {
    headers: {
      'x-forwarded-for': '203.0.113.9, 198.51.100.1',
      'x-real-ip': '198.51.100.2',
    },
  })
  assert.equal(resolvePublicRequestIp(request), 'unknown')
  assert.equal(resolvePublicRequestIp(request, { trustProxyHeaders: true }), '203.0.113.9')
  assert.notEqual(redactIp('203.0.113.9'), '203.0.113.9')
}

async function testLogRedaction(): Promise<void> {
  const events: PublicRequestGuardLog[] = []
  const secretEmail = 'Very.Secret@example.com'
  const secretIp = '203.0.113.99'
  const sensitiveValue = ['opaque', 'marker', '123'].join('-')
  const body = JSON.stringify({ email: secretEmail, name: 'Ada' })
  const request = jsonRequest(body, {
    headers: {
      'x-forwarded-for': secretIp,
      authorization: `Bearer ${sensitiveValue}`,
      cookie: `session=${sensitiveValue}`,
      referer: `${applicationOrigin}/private?ref=${sensitiveValue}`,
    },
  })

  const result = await guardPublicRequest(
    request,
    baseOptions({
      trustProxyHeaders: true,
      logger: (event: PublicRequestGuardLog) => events.push(event),
    }),
  )
  assert.equal(result.ok, true)
  assert.equal(events.length, 1)

  const serialized = JSON.stringify(events)
  for (const secret of [
    secretEmail,
    secretIp,
    sensitiveValue,
    body,
    applicationOrigin,
    '/private',
    'session=',
    'Bearer',
  ]) {
    assert.equal(serialized.includes(secret), false, `guard logs must redact ${secret}`)
  }
  assert.match(serialized, /public_request_guard/)
  assert.match(serialized, /public-test/)
  assert.match(serialized, /accepted/)
}

async function main(): Promise<void> {
  await testMethodAndContentType()
  await testBodyLimitsAndMalformedInput()
  await testOriginPolicy()
  await testFieldPolicy()
  testRedirectPolicy()
  await testRateLimitingAndNamespaces()
  testTrustedProxyPolicy()
  await testLogRedaction()
  console.log('public request guard tests passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
