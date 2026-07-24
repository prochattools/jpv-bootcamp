import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import type { LiveSessionStatus } from '@/lib/liveSessions/sessionLifecycle'

const ALLOWED_STATUSES = new Set<LiveSessionStatus>([
  'scheduled',
  'live',
  'completed',
  'cancelled',
])

function adminActor(administratorId: string | number) {
  return { id: administratorId, collection: 'payload_users' as const }
}

function relationshipValue(value: unknown): string | number | null | undefined {
  if (value === null) return null
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim()
    return normalized ? value : null
  }
  return undefined
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await resolvePayloadRequestSession(req.headers)
    if (!session.administratorId) {
      return NextResponse.json({ error: 'Unauthorized: admin required' }, { status: 403 })
    }

    const body = await req.json() as Record<string, unknown>
    const data: Record<string, unknown> = {}

    if (body.title !== undefined) {
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      if (!title) return NextResponse.json({ error: 'Title cannot be empty.' }, { status: 400 })
      data.title = title
    }
    if (body.scheduledAt !== undefined) {
      const scheduledAt = new Date(String(body.scheduledAt))
      if (Number.isNaN(scheduledAt.getTime())) {
        return NextResponse.json({ error: 'scheduledAt must be a valid date.' }, { status: 400 })
      }
      data.scheduledAt = scheduledAt.toISOString()
    }
    if (body.capacity !== undefined) {
      const capacity = Number(body.capacity)
      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
        return NextResponse.json(
          { error: 'Capacity must be an integer between 1 and 500.' },
          { status: 400 },
        )
      }
      data.capacity = capacity
    }
    if (body.status !== undefined) {
      const status = typeof body.status === 'string' ? body.status as LiveSessionStatus : null
      if (!status || !ALLOWED_STATUSES.has(status)) {
        return NextResponse.json(
          { error: 'Invalid status. Use scheduled, live, completed, or cancelled.' },
          { status: 400 },
        )
      }
      data.status = status
    }

    for (const field of ['course', 'module', 'lesson'] as const) {
      if (body[field] === undefined) continue
      const relationship = relationshipValue(body[field])
      if (relationship === undefined) {
        return NextResponse.json({ error: `${field} must be a Payload document ID.` }, { status: 400 })
      }
      if (field === 'course' && relationship === null) {
        return NextResponse.json({ error: 'Course cannot be removed.' }, { status: 400 })
      }
      data[field] = relationship
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No supported session changes were supplied.' }, { status: 400 })
    }

    const payload = await getPayload({ config })
    const { id } = await params
    const updated = await payload.update({
      collection: 'live_sessions',
      id,
      data,
      overrideAccess: true,
      user: adminActor(session.administratorId),
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/admin/sessions/[id] error', {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 400 },
    )
  }
}
