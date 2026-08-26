import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import type { PayloadCourseWriteAPI } from '@/lib/payloadCourse/accessService'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await resolvePayloadRequestSession(request.headers)
  if (!session.administratorId) return NextResponse.json({ ok: false, message: 'Administrator access is required.' }, { status: 403 })
  try {
    const body = await request.json() as Record<string, unknown>
    const status = body.status
    if (status !== 'live' && status !== 'completed' && status !== 'cancelled') return NextResponse.json({ ok: false, message: 'Only live, completed, or cancelled transitions are supported.' }, { status: 400 })
    const payload = await getPayload({ config }) as unknown as PayloadCourseWriteAPI
    const { id } = await params
    const updated = await payload.update({ collection: 'live_sessions', id, data: { status }, overrideAccess: true, user: { id: session.administratorId, collection: 'payload_users' } })
    return NextResponse.json({ ok: true, session: updated })
  } catch (error) {
    console.error('[portal live sessions PATCH] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : 'Unable to update live session.' }, { status: 400 })
  }
}
