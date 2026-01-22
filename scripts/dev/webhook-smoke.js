#!/usr/bin/env node

const assert = require('node:assert')
const fs = require('node:fs')
const path = require('node:path')
const Stripe = require('stripe')

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^"|"$/g, '')
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvFile(path.join(process.cwd(), '.env'))

const baseUrl =
  process.env.APP_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000'
const webhookPath = process.env.WEBHOOK_PATH || '/api/webhook/stripe'

const stripeEnv = (process.env.STRIPE_ENV || 'test').trim().toLowerCase()
const envSuffix = stripeEnv === 'live' ? 'LIVE' : 'TEST'
const secretKey = process.env[`STRIPE_SECRET_KEY_${envSuffix}`]
const webhookSecret = process.env[`STRIPE_WEBHOOK_SECRET_${envSuffix}`]

if (!secretKey || !webhookSecret) {
  console.error('[webhook-smoke] missing Stripe keys for STRIPE_ENV')
  process.exit(1)
}

const expectStatus = Number(process.env.WEBHOOK_EXPECT_STATUS || 200)
const expectDedupedStatus = process.env.WEBHOOK_EXPECT_DEDUPED_STATUS
  ? Number(process.env.WEBHOOK_EXPECT_DEDUPED_STATUS)
  : null

const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' })

const payload = {
  id: `evt_smoke_${Date.now()}`,
  object: 'event',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: `cs_smoke_${Date.now()}`,
      object: 'checkout.session',
      mode: 'subscription',
      customer: 'customer_smoke_123',
      customer_email: 'smoke@example.com',
    },
  },
}

const payloadString = JSON.stringify(payload)
const signature = stripe.webhooks.generateTestHeaderString({
  payload: payloadString,
  secret: webhookSecret,
})

async function sendWebhook() {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}${webhookPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Stripe-Signature': signature,
    },
    body: payloadString,
  })

  return response
}

async function main() {
  console.log(`[webhook-smoke] baseUrl=${baseUrl} path=${webhookPath}`)
  const first = await sendWebhook()
  assert.equal(first.status, expectStatus, `Unexpected webhook status: ${first.status}`)
  console.log('[webhook-smoke] first call ok')

  if (expectDedupedStatus !== null) {
    const second = await sendWebhook()
    assert.equal(
      second.status,
      expectDedupedStatus,
      `Unexpected deduped status: ${second.status}`
    )
    console.log('[webhook-smoke] dedupe call ok')
  }
}

main().catch((error) => {
  console.error('[webhook-smoke] failed:', error.message)
  process.exit(1)
})
