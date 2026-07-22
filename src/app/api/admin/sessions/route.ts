import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'

/**
 * GET /api/admin/sessions
 * List all live sessions (admin only).
 * Returns up to 200 sessions ordered by scheduledAt descending.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await resolvePayloadRequestSession(req.headers)

    if (!session.administratorId) {
      return NextResponse.json({ error: 'Unauthorized: admin required' }, { status: 403 })
    }

    const payload = await getPayload({ config })

    const result = await payload.find({
      collection: 'live_sessions' as any,
      limit: 200,
      sort: '-scheduledAt',
      depth: 1,
      overrideAccess: true,
    })

    return NextResponse.json({ sessions: result.docs, total: result.totalDocs })
  } catch (err) {
    console.error('GET /api/admin/sessions error', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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
    // hostUser is the relationship field name in the live_sessions collection.
    // Accept both 'hostUser' and legacy 'hostUserId' from callers.
    const { title, course, module, lesson, scheduledAt, capacity } = body
    const hostUser: string | undefined = body.hostUser ?? body.hostUserId

    if (!title || !course || !hostUser || !scheduledAt) {
      return NextResponse.json(
        { error: 'Missing required fields: title, course, hostUser (admin user ID), scheduledAt' },
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
        // hostUser is a relationship field pointing to payload_users — must be the user ID
        hostUser,
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
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
