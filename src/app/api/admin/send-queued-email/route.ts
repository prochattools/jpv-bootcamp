import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import { Resend } from 'resend'
import config from '@payload-config'
import {
  processQueuedPayloadEmails,
  type PayloadEmailSenderConfig,
} from '@/lib/payloadCourse/emailSender'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: NextRequest): Promise<Response> {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) return json({ ok: false, error: 'not_configured' }, 500)

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token || token !== secret) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400)
  }

  const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : null
  if (!eventId) {
    return json({ ok: false, error: 'event_id_required' }, 400)
  }

  const dryRun = body.dryRun === true

  const resendApiKey = process.env.RESEND_API_KEY
  if (!dryRun && !resendApiKey) {
    return json({ ok: false, error: 'resend_not_configured' }, 500)
  }

  const from = process.env.RESEND_FROM ?? process.env.EMAIL_FROM
  if (!from) {
    return json({ ok: false, error: 'sender_not_configured' }, 500)
  }

  const emailConfig: PayloadEmailSenderConfig = {
    from,
    replyTo: process.env.EMAIL_REPLY_TO || null,
  }

  try {
    const payload = await getPayload({ config })
    const resend = !dryRun && resendApiKey ? new Resend(resendApiKey) : undefined

    const outcomes = await processQueuedPayloadEmails(payload, {
      limit: 1,
      dryRun,
      resend,
      emailConfig,
      targetEventId: eventId,
    })

    const outcome = outcomes[0]
    if (!outcome) {
      return json({ ok: false, error: 'event_not_found_or_not_queued' }, 404)
    }

    return json({
      ok: outcome.status === 'sent' || outcome.status === 'dry_run',
      status: outcome.status,
      reason: outcome.reason ?? null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return json({ ok: false, error: 'processing_failed', detail: message }, 500)
  }
}
