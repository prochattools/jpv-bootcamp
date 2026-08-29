import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const read = (path: string) => readFileSync(path, 'utf8')

const adapter = read('src/lib/publicRequestRoute.ts')
const guard = read('src/lib/publicRequestGuard.ts')
const guardTests = read('scripts/public_request_guard.test.ts')
const support = read('src/app/api/support/route.ts')
const supportPersistence = read('src/lib/support/persistence.ts')
const subscribe = read('src/app/api/subscribe/route.ts')
const applications = read('src/app/api/sponsored-applications/route.ts')
const seatCheckout = read('src/app/api/sponsored-seats/checkout/route.ts')

function assertContains(source: string, values: string[], label: string): void {
  for (const value of values) {
    assert.ok(source.includes(value), `${label} must contain ${value}`)
  }
}

function assertGuardBefore(source: string, operation: string, label: string): void {
  const guardIndex = source.indexOf('guardPublicRequest(req')
  const operationIndex = source.indexOf(operation)
  assert.ok(guardIndex >= 0, `${label} must call guardPublicRequest`)
  assert.ok(operationIndex >= 0, `${label} must contain ${operation}`)
  assert.ok(guardIndex < operationIndex, `${label} must guard before ${operation}`)
}

function assertCommonRoutePolicy(
  source: string,
  namespace: string,
  maxBytesConstant: string,
  identityField: string,
  label: string,
): void {
  assertContains(
    source,
    [
      "methods: ['POST']",
      "bodyType: 'json'",
      "missingOrigin: 'reject'",
      'applicationOrigin',
      `maxBytes: ${maxBytesConstant}`,
      'allowUnknownFields: false',
      'trustProxyHeaders: trustPublicRequestProxyHeaders()',
      `namespace: '${namespace}'`,
      `identityField: '${identityField}'`,
      "backendFailure: 'deny'",
      'logger: logPublicRequestGuard',
      'if (guarded.ok === false)',
      'return publicRequestFailureResponse(guarded)',
    ],
    label,
  )
  assert.equal(source.includes('await req.json()'), false, `${label} must not parse the body twice`)
}

function testSharedAdapter(): void {
  assertContains(
    adapter,
    [
      'new InMemoryPublicRequestRateLimiter(4096)',
      'PUBLIC_REQUEST_TRUST_PROXY_HEADERS',
      'APP_PUBLIC_URL',
      'NEXT_PUBLIC_APP_URL',
      "headers.set('Retry-After'",
      'error: failure.code',
      'field: failure.field',
      'ipHash: event.ipHash',
      'emailHash: event.emailHash',
    ],
    'public request route adapter',
  )
  for (const forbidden of [
    'request.body',
    "headers.get('origin')",
    "headers.get('referer')",
    "headers.get('authorization')",
    "headers.get('cookie')",
    'request.url',
  ]) {
    assert.equal(adapter.includes(forbidden), false, `adapter must not log or inspect ${forbidden}`)
  }
}

function testSupport(): void {
  assertCommonRoutePolicy(support, 'public-support', 'SUPPORT_MAX_BYTES', 'email', 'support')
  assertContains(
    support,
    [
      'const SUPPORT_MAX_BYTES = 8 * 1024',
      "name: { type: 'string', required: true, minLength: 2, maxLength: 120 }",
      "email: { type: 'email', required: true, maxLength: 320 }",
      "question: { type: 'string', required: true, minLength: 10, maxLength: 2_000 }",
      'const service = createSupportIntakeService',
      'createSupportRequest',
      'updateSupportRequest',
      'queueAndAttemptEmailEvent',
      "SUPPORT_REQUEST_ADMIN_NOTIFICATION_TEMPLATE_KEY",
      "purpose: 'support_request_pending_review'",
      'SUPPORT_REQUEST_RECEIVED_TEMPLATE_KEY',
      "purpose: 'support_request_received'",
      '`support-request-acknowledgement:${input.requestId}`',
      'toEmail: input.requesterEmail',
      'accepted: true',
      'duplicate: result.duplicate',
      'error: result.code',
      '{ status: 503 }',
    ],
    'support route',
  )
  assertContains(
    supportPersistence,
    ['prisma.supportRequest.create', 'prisma.supportRequest.update'],
    'support persistence service',
  )
  assertGuardBefore(support, 'const service = createSupportIntakeService', 'support')
  assertGuardBefore(support, 'const result = await service', 'support')
  for (const forbidden of [
    'sendSupportEmail',
    'resendService',
    'randomUUID',
    'Math.random',
    "error: 'preview_only'",
    'applicationId',
    'SponsoredApplication',
    'SponsoredGrant',
  ]) {
    assert.equal(support.includes(forbidden), false, `support must not contain ${forbidden}`)
  }
}

function testSubscribe(): void {
  assertCommonRoutePolicy(
    subscribe,
    'public-subscribe',
    'SUBSCRIBE_MAX_BYTES',
    'email',
    'subscribe',
  )
  assertContains(
    subscribe,
    [
      'const SUBSCRIBE_MAX_BYTES = 2 * 1024',
      "email: { type: 'email', required: true, maxLength: 320 }",
      "name: { type: 'string', maxLength: 120 }",
      "source: { type: 'string', maxLength: 80 }",
      'const { email, name, source } = guarded.data',
      'prisma.emailSubscriber.findUnique',
      'prisma.emailSubscriber.create',
      'resendService.sendWelcomeEmail(email, name',
    ],
    'subscribe route',
  )
  assertGuardBefore(subscribe, 'prisma.emailSubscriber.findUnique', 'subscribe')
  assert.equal(subscribe.includes('console.info(email'), false)
  assert.equal(subscribe.includes('console.error(email'), false)
  assert.equal(subscribe.includes('normalizeEmail'), false)
}

function testSponsoredApplications(): void {
  assertCommonRoutePolicy(
    applications,
    'public-sponsored-applications',
    'SPONSORED_APPLICATION_MAX_BYTES',
    'email',
    'sponsored applications',
  )
  assertContains(
    applications,
    [
      'const SPONSORED_APPLICATION_MAX_BYTES = 12 * 1024',
      "name: { type: 'string', required: true, minLength: 2, maxLength: 120 }",
      "email: { type: 'email', required: true, maxLength: 320 }",
      "phone: { type: 'string', required: true, minLength: 7, maxLength: 40 }",
      "message: { type: 'string', maxLength: 2_000 }",
      'const { name, email: normalizedEmail, phone: phoneInput, message } = guarded.data',
      'isValidInternationalPhone(phone)',
      'prisma.sponsoredApplication.findFirst',
      'sendSponsoredApplicationAdminEmail',
      'return NextResponse.json({ ok: true, outcome })',
    ],
    'sponsored applications route',
  )
  assertGuardBefore(
    applications,
    'prisma.sponsoredApplication.findFirst',
    'sponsored applications',
  )
  assert.equal(applications.includes('normalizeEmail'), false)
  assert.equal(applications.includes('redactEmail'), false)
  assert.equal(applications.includes('outcome, applicationId'), false)
  assert.equal(applications.includes("message: (error as Error).message"), false)
}

function testSponsoredSeatCheckout(): void {
  assertCommonRoutePolicy(
    seatCheckout,
    'public-sponsored-seat-checkout',
    'SPONSORED_SEAT_CHECKOUT_MAX_BYTES',
    'donorEmail',
    'sponsored-seat checkout',
  )
  assertContains(
    seatCheckout,
    [
      'const SPONSORED_SEAT_CHECKOUT_MAX_BYTES = 2 * 1024',
      "tier: { type: 'enum', values: ['free'] as const }",
      "quantity: { type: 'enum', values: ['1'] as const }",
      "donorEmail: { type: 'email', maxLength: 320 }",
      "returnPath: { type: 'redirect', fallback: '/' }",
      'new URL(guarded.data.returnPath, applicationOrigin).toString()',
      'quantity: 1',
      "access: 'free'",
      'stripe.checkout.sessions.create',
      'customer_email: guarded.data.donorEmail',
    ],
    'sponsored-seat checkout route',
  )
  assertGuardBefore(seatCheckout, 'getSponsoredPriceId()', 'sponsored-seat checkout')
  assertGuardBefore(seatCheckout, 'stripe.checkout.sessions.create', 'sponsored-seat checkout')
  assert.equal(seatCheckout.includes('await req.json()'), false)
  assert.equal(seatCheckout.includes("message: (error as Error).message"), false)
  assert.equal(seatCheckout.includes('amount:'), false)
}

function testSharedNegativeCoverage(): void {
  assertContains(
    guardTests,
    [
      'testMethodAndContentType',
      'testBodyLimitsAndMalformedInput',
      'testOriginPolicy',
      'testFieldPolicy',
      'testRedirectPolicy',
      'testRateLimitingAndNamespaces',
      'testTrustedProxyPolicy',
      'testLogRedaction',
      'payload_too_large',
      'origin_forbidden',
      'origin_invalid',
      'origin_required',
      'field_unknown',
      'field_nested',
      'rate_limited',
      'retryAfterSeconds',
      'rate_limit_unavailable',
      "sanitizePublicRedirect({ value: '//evil.example/path'",
      "sanitizePublicRedirect({ value: '/%2f%2fevil.example'",
    ],
    'shared guard negative coverage',
  )
  assertContains(
    guard,
    [
      'DEFAULT_PUBLIC_REQUEST_MAX_BYTES',
      'normalizeEmail(value)',
      'sanitizePublicRedirect',
      'allowUnknownFields ?? false',
      'backendFailure',
    ],
    'shared guard implementation',
  )
}

try {
  testSharedAdapter()
  testSupport()
  testSubscribe()
  testSponsoredApplications()
  testSponsoredSeatCheckout()
  testSharedNegativeCoverage()
  console.log('public write route guard adoption tests passed')
} catch (error) {
  console.error(
    'public write route guard adoption tests failed',
    error instanceof Error ? error.message : error,
  )
  process.exitCode = 1
}
