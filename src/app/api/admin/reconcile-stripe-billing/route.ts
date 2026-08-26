import { randomUUID, timingSafeEqual } from 'node:crypto'

import config from '@payload-config'
import { getPayload } from 'payload'

import { sweepExpiredPaymentGrace } from '@/lib/billing/delinquencySweep'
import { reconcileStripeToPayload } from '@/lib/billing/stripePayloadReconciliation'
import type { StripePayloadReconciliationCheckpoint } from '@/lib/billing/stripePayloadReconciliation'
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

  let mode: 'apply' | 'dry-run' = 'apply'
  let suppressCommunications = false
  let maxObjects = 10_000
  let checkpoint: StripePayloadReconciliationCheckpoint | null = null
  try {
    const body = await request.json() as { mode?: unknown; confirmation?: unknown; maxObjects?: unknown; checkpoint?: unknown }
    if (body.mode !== undefined && body.mode !== 'apply' && body.mode !== 'dry-run') {
      return json({ ok: false, error: 'invalid_mode' }, 400)
    }
    mode = body.mode === 'dry-run' ? 'dry-run' : 'apply'
    suppressCommunications = body.confirmation === 'initial_backfill_suppress_communications'
    if (typeof body.maxObjects === 'number' && Number.isInteger(body.maxObjects)) {
      maxObjects = Math.min(Math.max(body.maxObjects, 1), 10_000)
    }
    if (body.checkpoint && typeof body.checkpoint === 'object') {
      const candidate = body.checkpoint as { phase?: unknown; startingAfter?: unknown }
      const startingAfter = candidate.startingAfter
      if (
        (candidate.phase === 'subscriptions' || candidate.phase === 'invoices') &&
        (startingAfter === null || typeof startingAfter === 'string')
      ) {
        const normalizedStartingAfter: string | null =
          typeof startingAfter === 'string' ? startingAfter : null
        checkpoint = candidate.phase === 'subscriptions'
          ? { phase: 'subscriptions', startingAfter: normalizedStartingAfter }
          : { phase: 'invoices', startingAfter: normalizedStartingAfter }
      }
    }
  } catch {
    // Scheduled calls may omit a body. Normal reconciliation keeps communications enabled.
  }

  const runId = randomUUID()
  try {
    const payload = await getPayload({ config })
    const stripeConfig = getStripeConfig()
    let reconciliation: Awaited<ReturnType<typeof reconcileStripeToPayload>> | null = null
    let reconciliationFailed = false
    try {
      reconciliation = await reconcileStripeToPayload({
        payload,
        stripe: getStripe(),
        mode,
        livemode: stripeConfig.env === 'live',
        runId,
        maxObjects,
        pageSize: 100,
        suppressCommunications,
        checkpoint,
      })
    } catch (error) {
      reconciliationFailed = true
      console.error('stripe_billing_reconciliation_phase_failed', {
        runId,
        error: error instanceof Error ? error.message : 'unknown_error',
      })
    }

    const delinquency = mode === 'apply' ? await sweepExpiredPaymentGrace({ payload }) : null
    const failed = (reconciliation?.totals.failed ?? 0) + (delinquency?.failed ?? 0)
    const ok = !reconciliationFailed && reconciliation !== null && failed === 0

    return json({
      ok,
      runId,
      reconciliation: reconciliation?.totals ?? null,
      reconciliationError: reconciliationFailed ? 'stripe_reconciliation_failed' : null,
      checkpoint: reconciliation?.checkpoint ?? null,
      mode,
      communicationsSuppressed: suppressCommunications,
      delinquency,
    }, ok ? 200 : 500)
  } catch (error) {
    console.error('stripe_billing_reconciliation_failed', {
      runId,
      error: error instanceof Error ? error.message : 'unknown_error',
    })
    return json({ ok: false, error: 'processing_failed' }, 500)
  }
}
