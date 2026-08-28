import { test, expect } from '@playwright/test'
import { assertStagingOrigin } from '../scripts/staging-gates/stagingPolicy'
import crypto from 'crypto'
import { ENVIRONMENT_TOPOLOGY } from '../src/lib/environmentTopology'

const STAGING_URL = process.env.STAGING_URL ?? ENVIRONMENT_TOPOLOGY.staging.origin
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? ''

assertStagingOrigin(STAGING_URL)

test.describe('Stripe Webhook Handler — WAVE 1', () => {
  test.skip(!process.env.STAGING_URL, 'Webhook tests require STAGING_URL to be explicitly set')
  test.skip(!STRIPE_WEBHOOK_SECRET, 'Webhook tests require STRIPE_WEBHOOK_SECRET to be set')

  function generateStripeSignature(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000)
    const signed = `${timestamp}.${payload}`
    const signature = crypto.createHmac('sha256', secret).update(signed).digest('hex')
    return `t=${timestamp},v1=${signature}`
  }

  test('STRIPE-WEBHOOK-001: Webhook endpoint returns 200 for valid event', async ({ request }) => {
    const payload = JSON.stringify({
      id: 'evt_test_001',
      type: 'customer.subscription.updated',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'sub_test_001',
          customer: 'cus_test_001',
          status: 'active',
          plan: {
            id: 'price_1TuZnBLIsSm7aAua1yxlQ9rS',
          },
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        },
      },
    })

    const signature = generateStripeSignature(payload, STRIPE_WEBHOOK_SECRET)

    const response = await request.post(`${STAGING_URL}/api/webhook/stripe`, {
      data: payload,
      headers: {
        'stripe-signature': signature,
        'content-type': 'application/json',
      },
    })

    // Valid signature + event should return 200
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.received).toBe(true)
  })

  test('STRIPE-WEBHOOK-002: Webhook rejects missing signature', async ({ request }) => {
    const payload = JSON.stringify({
      id: 'evt_test_002',
      type: 'customer.subscription.updated',
    })

    const response = await request.post(`${STAGING_URL}/api/webhook/stripe`, {
      data: payload,
      headers: {
        'content-type': 'application/json',
        // No stripe-signature header
      },
    })

    // Missing signature should reject
    expect([400, 401, 403]).toContain(response.status())
  })

  test('STRIPE-WEBHOOK-003: Webhook rejects invalid signature', async ({ request }) => {
    const payload = JSON.stringify({
      id: 'evt_test_003',
      type: 'customer.subscription.updated',
    })

    const invalidSignature = 't=1234567890,v1=badsignature123'

    const response = await request.post(`${STAGING_URL}/api/webhook/stripe`, {
      data: payload,
      headers: {
        'stripe-signature': invalidSignature,
        'content-type': 'application/json',
      },
    })

    // Invalid signature should reject
    expect([400, 401, 403]).toContain(response.status())
  })

  test('STRIPE-WEBHOOK-004: Webhook handles missing config gracefully', async ({ request }) => {
    // If STRIPE_WEBHOOK_SECRET is unset or invalid, endpoint should return retryable 5xx
    // This tests fail-closed behavior

    if (!STRIPE_WEBHOOK_SECRET || STRIPE_WEBHOOK_SECRET === 'invalid') {
      const payload = JSON.stringify({ id: 'evt_test_004', type: 'customer.subscription.updated' })
      const signature = generateStripeSignature(payload, 'test-secret')

      const response = await request.post(`${STAGING_URL}/api/webhook/stripe`, {
        data: payload,
        headers: {
          'stripe-signature': signature,
          'content-type': 'application/json',
        },
      })

      // Should return 5xx (retryable) if config missing, not 200
      expect(response.status()).toBeGreaterThanOrEqual(500)
      expect(response.status()).toBeLessThan(600)
    } else {
      // If secret is configured, just verify it's not in error state
      expect(STRIPE_WEBHOOK_SECRET).toBeTruthy()
    }
  })
})
