import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'

import { PARTNERS_SESSION_COOKIE, getPartnerSession, sanitizeSessionId } from '@/lib/partners-session'
import { buildPartnerAdminReport, serializePartnerReportCsv } from '@/lib/partnerAffiliateReporting'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAdminId(value: number): boolean {
  const raw = process.env.PARTNERS_ADMIN_WP_USER_IDS ?? ''
  return raw
    .split(',')
    .map((item) => Number(item.trim()))
    .some((id) => Number.isInteger(id) && id === value)
}

export async function GET(req: NextRequest) {
  const sessionId = sanitizeSessionId(req.cookies.get(PARTNERS_SESSION_COOKIE)?.value)
  if (!sessionId) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  const session = await getPartnerSession(sessionId)
  if (!session || !isAdminId(session.wpUserId)) return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 })

  const payload = await getPayload({ config })
  const report = await buildPartnerAdminReport(payload as never, {})
  const csv = serializePartnerReportCsv(report.rows)
  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': 'attachment; filename=partner-applications.csv',
    },
  })
}
