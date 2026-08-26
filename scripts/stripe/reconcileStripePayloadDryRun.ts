import Stripe from 'stripe'
import config from '@payload-config'
import { getPayload } from 'payload'

import { reconcileStripeToPayload } from '../../src/lib/billing/stripePayloadReconciliation'

async function main(): Promise<void> {
  if (!process.argv.includes('--expected-live')) {
    throw new Error('expected_live_confirmation_required')
  }
  if (process.env.STRIPE_ENV?.trim().toLowerCase() !== 'live') {
    throw new Error('stripe_environment_is_not_live')
  }
  const secretKey = process.env.STRIPE_SECRET_KEY_LIVE?.trim()
  if (!secretKey?.startsWith('sk_live_')) throw new Error('live_stripe_secret_missing_or_invalid')
  const stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' })
  const payload = await getPayload({ config })

  const report = await reconcileStripeToPayload({
    payload,
    stripe,
    mode: 'dry-run',
    livemode: true,
    runId: `dry_run_${new Date().toISOString()}`,
    maxObjects: 10_000,
    pageSize: 100,
  })

  const statusCounts = Object.fromEntries(
    [...new Set(report.rows.map((row) => `${row.objectType}:${row.status}`))]
      .sort()
      .map((key) => [key, report.rows.filter((row) => `${row.objectType}:${row.status}` === key).length]),
  )
  console.log(JSON.stringify({
    mode: report.mode,
    livemode: report.livemode,
    totals: report.totals,
    statusCounts,
    checkpoint: report.checkpoint,
    reviewRows: report.rows.filter((row) => row.disposition === 'review_required'),
  }, null, 2))
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'unknown_error')
  process.exitCode = 1
})
