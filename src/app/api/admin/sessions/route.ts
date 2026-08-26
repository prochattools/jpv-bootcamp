import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'

function adminActor(administratorId: string | number) {
  return { id: administratorId, collection: 'payload_users' as const }
}

function asOptionalRelationship(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number') {
    const normalized = String(value).trim()
    return normalized ? value : undefined
  }
  return undefined
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await resolvePayloadRequestSession(req.headers)
    if (!session.administratorId) {
      return NextResponse.json({ error: 'Unauthorized: admin required' }, { status: 403 })
    }

    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'live_sessions',
      limit: 200,
      sort: '-scheduledAt',
      depth: 2,
      overrideAccess: true,
    })

    return NextResponse.json({ sessions: result.docs, total: result.totalDocs })
  } catch (error) {
    console.error('GET /api/admin/sessions error', {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await resolvePayloadRequestSession(req.headers)
    if (!session.administratorId) {
      return NextResponse.json({ error: 'Unauthorized: admin required' }, { status: 403 })
    }

    const body = await req.json() as Record<string, unknown>
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const course = asOptionalRelationship(body.course)
    const module = asOptionalRelationship(body.module)
    const lesson = asOptionalRelationship(body.lesson)
    const scheduledDate = new Date(String(body.scheduledAt ?? ''))
    const capacity = Number(body.capacity ?? 50)

    if (!title || course === undefined || Number.isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        { error: 'Valid title, course, and scheduledAt are required.' },
        { status: 400 },
      )
    }
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) {
      return NextResponse.json(
        { error: 'Capacity must be an integer between 1 and 500.' },
        { status: 400 },
      )
    }

    const payload = await getPayload({ config })
    const liveSession = await payload.create({
      collection: 'live_sessions',
      data: {
        title,
        course,
        module,
        lesson,
        hostUser: session.administratorId,
        scheduledAt: scheduledDate.toISOString(),
        capacity,
        status: 'scheduled',
      } as any,
      overrideAccess: true,
      user: adminActor(session.administratorId),
    })

    return NextResponse.json(liveSession, { status: 201 })
  } catch (error) {
    console.error('POST /api/admin/sessions error', {
      message: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 400 },
    )
  }
}
