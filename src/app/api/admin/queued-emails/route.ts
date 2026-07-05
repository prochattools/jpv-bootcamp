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
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) return json({ ok: false, error: 'not_configured' }, 500)

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token || token !== secret) {
    return json({ ok: false, error: 'unauthorized' }, 401)
  }

  const payload = await getPayload({ config })

  const result = await payload.find({
    collection: 'payload_email_events',
    where: { deliveryStatus: { equals: 'queued' } },
    limit: 10,
    depth: 0,
    sort: '-createdAt',
    overrideAccess: true,
  })

  const events = result.docs.map((doc) => ({
    id: doc.id,
    templateKey: doc.templateKey ?? null,
    deliveryStatus: doc.deliveryStatus ?? null,
    createdAt: doc.createdAt ?? null,
    displayName: doc.displayName ?? null,
  }))

  return json({ ok: true, total: result.totalDocs, events })
}
