import { NextRequest } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function GET(request: NextRequest): Promise<Response> {
  // Accepts both EMAIL_QUEUE_WORKER_SECRET and PAYLOAD_SECRET for operator convenience.
  const secret = process.env.EMAIL_QUEUE_WORKER_SECRET ?? process.env.PAYLOAD_SECRET
  if (!secret) return json({ ok: false, error: 'not_configured' }, 500)

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token || token !== secret) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const payload = await getPayload({ config })

  const statusFilter = request.nextUrl.searchParams.get('status') || 'queued'
  const where = statusFilter === 'all'
    ? {}
    : { deliveryStatus: { equals: statusFilter } }

  const [eventResult, lastSentResult, oldestQueuedResult, processingResult, lastFailedResult] = await Promise.all([
    payload.find({
      collection: 'payload_email_events',
      where,
      limit: 10,
      depth: 0,
      sort: '-createdAt',
      overrideAccess: true,
    }),
    payload.find({
      collection: 'payload_email_events',
      where: { deliveryStatus: { equals: 'sent' } },
      limit: 1,
      depth: 0,
      sort: '-sentAt',
      overrideAccess: true,
    }),
    payload.find({
      collection: 'payload_email_events',
      where: { deliveryStatus: { in: ['queued', 'processing'] } },
      limit: 1,
      depth: 0,
      sort: 'createdAt',
      overrideAccess: true,
    }),
    payload.find({
      collection: 'payload_email_events',
      where: { deliveryStatus: { equals: 'processing' } },
      limit: 10,
      depth: 0,
      sort: 'claimedAt',
      overrideAccess: true,
    }),
    payload.find({
      collection: 'payload_email_events',
      where: { deliveryStatus: { equals: 'failed' } },
      limit: 1,
      depth: 0,
      sort: '-updatedAt',
      overrideAccess: true,
    }),
  ])

  const events = eventResult.docs.map((doc) => ({
    id: doc.id,
    templateKey: doc.templateKey ?? null,
    deliveryStatus: doc.deliveryStatus ?? null,
    createdAt: doc.createdAt ?? null,
    displayName: doc.displayName ?? null,
    // Redact failureReason for safety — strip any token-like substrings
    failureReason: typeof doc.failureReason === 'string'
      ? doc.failureReason.replace(/Bearer\s+\S+/gi, '[redacted]').slice(0, 200)
      : null,
  }))

  const lastSent = lastSentResult.docs[0] ?? null
  const oldest = oldestQueuedResult.docs[0] ?? null
  const now = new Date()
  const oldestQueuedAgeMs = oldest?.createdAt
    ? now.getTime() - new Date(oldest.createdAt as string).getTime()
    : null

  const staleProcessingCount = processingResult.docs.filter((doc) => {
    const claimedAt = (doc as unknown as Record<string, unknown>).claimedAt
    if (!claimedAt) return false
    return now.getTime() - new Date(claimedAt as string).getTime() > 5 * 60 * 1000
  }).length

  return json({
    ok: true,
    total: eventResult.totalDocs,
    events,
    diagnostics: {
      lastSentAt: lastSent?.sentAt ?? null,
      oldestQueuedCreatedAt: oldest?.createdAt ?? null,
      oldestQueuedAgeMs,
      processingCount: processingResult.totalDocs,
      staleProcessingCount,
      retryableCount: lastFailedResult.totalDocs,
      lastFailureReason: typeof lastFailedResult.docs[0]?.failureReason === 'string'
        ? lastFailedResult.docs[0].failureReason.replace(/Bearer\s+\S+/gi, '[redacted]').slice(0, 200)
        : null,
    },
  })
}
