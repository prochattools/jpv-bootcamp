import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'

/**
 * POST /api/admin/sessions
 * Create a new live session (admin only)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await resolvePayloadRequestSession(req.headers)

    // Admin-only access
    if (!session.administratorId) {
      return NextResponse.json({ error: 'Unauthorized: admin required' }, { status: 403 })
    }

    const body = await req.json()
    const { title, course, module, lesson, hostUserId, scheduledAt, capacity } = body

    if (!title || !course || !hostUserId || !scheduledAt) {
      return NextResponse.json(
        { error: 'Missing required fields: title, course, hostUserId, scheduledAt' },
        { status: 400 }
      )
    }

    const payload = await getPayload({ config })

    // Create live session
    const liveSession = await payload.create({
      collection: 'live_sessions' as any,
      data: {
        title,
        course,
        module: module || 'default',
        lesson: lesson || 'default',
        hostUserId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        capacity: capacity || 50,
        status: 'scheduled',
        audit: [
          {
            event: 'created',
            timestamp: new Date().toISOString(),
            operator: session.administratorId,
          },
        ],
      },
      overrideAccess: true,
      user: session as any,
    })

    return NextResponse.json(liveSession)
  } catch (err) {
    console.error('POST /api/admin/sessions error', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
