import { NextRequest } from 'next/server'
import { processEmailQueue } from '@/lib/email'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/process-prisma-email-queue
 *
 * Trigger a processing pass of the Prisma email_events outbox.
 * Authentication: Bearer PAYLOAD_SECRET (same pattern as the Payload queue endpoint).
 *
 * Body (JSON, all fields optional):
 *   { eventId?: string }
 *   - Omit eventId to process all pending events.
 *   - Provide eventId to process a single event by DB row id.
 *
 * Returns:
 *   { ok: true, processed, sent, failed, skipped }
 *
 * This endpoint is intentionally not exposed to public callers.
 * Call it from a cron job or the admin CLI with the PAYLOAD_SECRET header.
 */
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

  let body: Record<string, unknown> = {}
  const contentType = request.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      body = await request.json()
    } catch {
      return json({ ok: false, error: 'invalid_json' }, 400)
    }
  }

  const eventId = typeof body.eventId === 'string' && body.eventId.trim()
    ? body.eventId.trim()
    : undefined

  try {
    const result = await processEmailQueue(eventId)
    return json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error'
    return json({ ok: false, error: 'processing_failed', detail: message }, 500)
  }
}
