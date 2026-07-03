import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'

import { PARTNERS_SESSION_COOKIE, getPartnerSession, sanitizeSessionId } from '@/lib/partners-session'
import { retryPartnerDelivery } from '@/lib/payloadCourse/partnerDelivery'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAdminId(value: number): boolean {
  const raw = process.env.PARTNERS_ADMIN_WP_USER_IDS ?? ''
  return raw
    .split(',')
    .map((item) => Number(item.trim()))
    .some((id) => Number.isInteger(id) && id === value)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sessionId = sanitizeSessionId(req.cookies.get(PARTNERS_SESSION_COOKIE)?.value)
  if (!sessionId) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  const session = await getPartnerSession(sessionId)
  if (!session || !isAdminId(session.wpUserId)) return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 })

  const payload = await getPayload({ config })
  const { id } = await params
  const result = await retryPartnerDelivery(payload as never, id, session.wpUserId)
  return NextResponse.json({ ok: true, status: result.status })
}
