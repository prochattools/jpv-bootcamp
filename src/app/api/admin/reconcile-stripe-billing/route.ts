import { randomUUID, timingSafeEqual } from 'node:crypto'

import config from '@payload-config'
import { getPayload } from 'payload'

import { sweepExpiredPaymentGrace } from '@/lib/billing/delinquencySweep'
import { reconcileStripeToPayload } from '@/lib/billing/stripePayloadReconciliation'
import { getStripe } from '@/lib/stripe'
import { getStripeConfig } from '@/lib/stripe-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

function authorized(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization')
  const token = header?.startsWith('Bearer ') ? header.slice(7) : ''
  const actual = Buffer.from(token)
  const expected = Buffer.from(secret)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.BILLING_RECONCILIATION_WORKER_SECRET
  if (!secret) return json({ ok: false, error: 'not_configured' }, 500)
  if (!authorized(request, secret)) return json({ ok: false, error: 'unauthorized' }, 401)

  let suppressCommunications = false
  let maxObjects = 10_000
  try {
    const body = await request.json() as { confirmation?: unknown; maxObjects?: unknown }
    suppressCommunications = body.confirmation === 'initial_backfill_suppress_communications'
    if (typeof body.maxObjects === 'number' && Number.isInteger(body.maxObjects)) {
      maxObjects = Math.min(Math.max(body.maxObjects, 1), 10_000)
    }
  } catch {
    // Scheduled calls may omit a body. Normal reconciliation keeps communications enabled.
  }

  try {
    const payload = await getPayload({ config })
    const stripeConfig = getStripeConfig()
    const reconciliation = await reconcileStripeToPayload({
      payload,
      stripe: getStripe(),
      mode: 'apply',
      livemode: stripeConfig.env === 'live',
      runId: randomUUID(),
      maxObjects,
      pageSize: 100,
      suppressCommunications,
    })
    const delinquency = await sweepExpiredPaymentGrace({ payload })
    const failed = reconciliation.totals.failed + delinquency.failed

    return json({
      ok: failed === 0,
      runId: reconciliation.runId,
      reconciliation: reconciliation.totals,
      checkpoint: reconciliation.checkpoint,
      communicationsSuppressed: suppressCommunications,
      delinquency,
    }, failed === 0 ? 200 : 500)
  } catch (error) {
    console.error('stripe_billing_reconciliation_failed', {
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    return json({ ok: false, error: 'processing_failed' }, 500)
  }
}
