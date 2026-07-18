import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'

/**
 * PATCH /api/admin/sessions/[id]
 * Update session status (admin only)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const session = await resolvePayloadRequestSession(req.headers)

    // Admin-only access
    if (!session.administratorId) {
      return NextResponse.json({ error: 'Unauthorized: admin required' }, { status: 403 })
    }

    const body = await req.json()
    const { status } = body

    if (!status || !['scheduled', 'live', 'completed', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: scheduled, live, completed, cancelled' },
        { status: 400 }
      )
    }

    const payload = await getPayload({ config })

    // Update session
    const updated = await payload.update({
      collection: 'live_sessions' as any,
      id: params.id,
      data: {
        status,
        audit: {
          event: `status_updated_to_${status}`,
          timestamp: new Date().toISOString(),
          operator: session.administratorId,
        },
      },
      overrideAccess: true,
      user: session as any,
    })

    return NextResponse.json(updated)
  } catch (err) {
    console.error(`PATCH /api/admin/sessions/[id] error`, err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
