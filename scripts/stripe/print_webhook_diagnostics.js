#!/usr/bin/env node

const { execSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

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
loadEnvFile(path.join(process.cwd(), '.env.local'))

const baseUrl =
  process.env.APP_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'http://localhost:3000'
const webhookPath = process.env.WEBHOOK_PATH || '/api/webhook/stripe'
const webhookUrl = `${baseUrl.replace(/\/$/, '')}${webhookPath}`

const stripeEnv = (process.env.STRIPE_ENV || 'test').trim().toLowerCase()
const envSuffix = stripeEnv === 'live' ? 'LIVE' : 'TEST'
const stripeSecretKey = process.env[`STRIPE_SECRET_KEY_${envSuffix}`]
const webhookSecret = process.env[`STRIPE_WEBHOOK_SECRET_${envSuffix}`]

const hasStripeCli = (() => {
  try {
    execSync('stripe --version', { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
})()

console.log('[webhook-diagnostics] baseUrl:', baseUrl)
console.log('[webhook-diagnostics] webhookPath:', webhookPath)
console.log('[webhook-diagnostics] webhookUrl:', webhookUrl)
console.log('[webhook-diagnostics] NODE_ENV:', process.env.NODE_ENV || 'unset')
console.log('[webhook-diagnostics] DEBUG_STRIPE_WEBHOOKS:', process.env.DEBUG_STRIPE_WEBHOOKS || 'unset')
console.log('[webhook-diagnostics] STRIPE_ENV:', stripeEnv)
console.log('[webhook-diagnostics] Stripe secret key present:', Boolean(stripeSecretKey))
console.log(
  '[webhook-diagnostics] Stripe webhook secret prefix:',
  webhookSecret ? webhookSecret.slice(0, 6) : 'unset'
)
console.log('[webhook-diagnostics] stripe CLI available:', hasStripeCli)

if (process.env.PING_WEBHOOK === '1') {
  fetch(webhookUrl, { method: 'GET' })
    .then((res) => {
      console.log('[webhook-diagnostics] GET status:', res.status)
    })
    .catch((error) => {
      console.error('[webhook-diagnostics] GET failed:', error.message)
    })
}
