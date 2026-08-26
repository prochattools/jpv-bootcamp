import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import { Resend } from 'resend'
import config from '@payload-config'
import { processQueuedPayloadEmails } from '@/lib/payloadCourse/emailSender'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/process-payload-email-queue
 *
 * Flush the payload_email_events outbox: recover stale leases, find all rows
 * with delivery_status = 'queued' and send them via Resend. Designed to be
 * called by a periodic cron job (Dokploy scheduled task).
 *
 * Authentication: Bearer EMAIL_QUEUE_WORKER_SECRET (never the admin secret)
 *
 * Body (JSON, optional):
 *   { limit?: number }   — max events to process per call (default 25)
 *
 * Response:
 *   { ok: true, processed, sent, failed, skipped, staleRecovered }
 */
function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest): Promise<Response> {
  // Dedicated queue-worker credential — never the admin secret.
  const secret = process.env.EMAIL_QUEUE_WORKER_SECRET
  if (!secret) return json({ ok: false, error: 'not_configured' }, 500)

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token || token !== secret) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const resendApiKey = process.env.RESEND_API_KEY
  if (!resendApiKey) {
    return json({ ok: false, error: 'resend_not_configured' }, 500)
  }

  const from = process.env.RESEND_FROM ?? process.env.EMAIL_FROM
  if (!from) {
    return json({ ok: false, error: 'sender_not_configured' }, 500)
  }

  let limit = 25
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      const body = await request.json()
      if (typeof body.limit === 'number' && body.limit > 0 && body.limit <= 100) {
        limit = body.limit
      }
    } catch {
      // Non-fatal — use default limit
    }
  }

  try {
    const payload = await getPayload({ config })
    const resend = new Resend(resendApiKey)

    const outcomes = await processQueuedPayloadEmails(payload, {
      limit,
      resend,
      emailConfig: {
        from,
        replyTo: process.env.EMAIL_REPLY_TO || null,
      },
    })

    const sent = outcomes.filter((o) => o.status === 'sent').length
    const failed = outcomes.filter((o) => o.status === 'failed').length
    const skipped = outcomes.filter((o) => o.status === 'skipped').length

    return json({ ok: true, processed: outcomes.length, sent, failed, skipped })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    console.error('process_payload_email_queue_failed', { error: message })
    return json({ ok: false, error: 'processing_failed' }, 500)
  }
}
