import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { notifyLiveSessionRecipients } from '@/lib/liveSessions/audience'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function id(value: unknown): string | undefined {
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim() || undefined
  if (value && typeof value === 'object' && 'id' in value) return id((value as { id: unknown }).id)
  return undefined
}

function adminActor(idValue: string | number) {
  return { id: idValue, collection: 'payload_users' as const }
}

async function requireAdmin(request: NextRequest): Promise<string | null> {
  const session = await resolvePayloadRequestSession(request.headers)
  return session.administratorId ? String(session.administratorId) : null
}

export async function GET(request: NextRequest) {
  const administratorId = await requireAdmin(request)
  if (!administratorId) return NextResponse.json({ ok: false, message: 'Administrator access is required.' }, { status: 403 })
  const payload = await getPayload({ config })
  const result = await payload.find({ collection: 'live_sessions', limit: 200, sort: '-scheduledAt', depth: 1, overrideAccess: true })
  return NextResponse.json({ ok: true, sessions: result.docs })
}

export async function POST(request: NextRequest) {
  const administratorId = await requireAdmin(request)
  if (!administratorId) return NextResponse.json({ ok: false, message: 'Administrator access is required.' }, { status: 403 })
  try {
    const body = await request.json() as Record<string, unknown>
    const title = text(body.title)
    const scheduledAt = new Date(text(body.scheduledAt) || Date.now())
    const course = id(body.course)
    const space = id(body.space)
    const audience = body.audience === 'all' || body.audience === 'selected' ? body.audience : 'enrolled'
    const targetMemberIds = audience === 'selected' && Array.isArray(body.targetMemberIds) ? body.targetMemberIds.map(id).filter((value): value is string => Boolean(value)) : undefined
    const capacity = Number(body.capacity ?? 50)
    if (!title || (!course && !space) || (course && space) || Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ ok: false, message: 'Title, exactly one course or space, and a valid schedule are required.' }, { status: 400 })
    }
    if (audience === 'selected' && (!targetMemberIds || targetMemberIds.length === 0)) {
      return NextResponse.json({ ok: false, message: 'Select at least one member for a targeted session.' }, { status: 400 })
    }
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) return NextResponse.json({ ok: false, message: 'Capacity must be between 1 and 500.' }, { status: 400 })

    const payload = await getPayload({ config }) as unknown as PayloadCourseWriteAPI
    const created = await payload.create({
      collection: 'live_sessions',
      data: {
        title,
        course,
        space,
        hostUser: administratorId,
        scheduledAt: scheduledAt.toISOString(),
        capacity,
        audience,
        targetMemberIds,
        status: 'scheduled',
      },
      overrideAccess: true,
      user: adminActor(administratorId),
    })
    const baseUrl = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://jpvbootcamp.com'
    let emailEventsCreated = 0
    let invitationWarning: string | undefined
    try {
      emailEventsCreated = await notifyLiveSessionRecipients(payload, created, baseUrl)
    } catch (error) {
      invitationWarning = 'The session was created, but invitations could not be fully queued. Review the email queue.'
      console.error('[portal live sessions POST] invitation fan-out failed:', error instanceof Error ? error.message : String(error))
    }
    return NextResponse.json({ ok: true, session: created, emailEventsCreated, invitationWarning }, { status: 201 })
  } catch (error) {
    console.error('[portal live sessions POST] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : 'Unable to create live session.' }, { status: 400 })
  }
}
