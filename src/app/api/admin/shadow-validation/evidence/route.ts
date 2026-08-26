import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'

import { PARTNERS_SESSION_COOKIE, getPartnerSession, sanitizeSessionId } from '@/lib/partners-session'
import { isSponsoredSeatsAdmin } from '@/lib/sponsored-admin'
import { buildShadowValidationReport, createShadowValidationAdapter } from '@/lib/shadowValidationReport'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function isAdminId(value: number): boolean {
  const raw = process.env.SPONSORED_SEATS_ADMIN_ACCOUNT_IDS ?? ''
  return raw
    .split(',')
    .map((item) => Number(item.trim()))
    .some((id) => Number.isInteger(id) && id === value)
}

export async function GET(req: NextRequest) {
  const sessionId = sanitizeSessionId(req.cookies.get(PARTNERS_SESSION_COOKIE)?.value)
  if (!sessionId) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  const session = await getPartnerSession(sessionId)
  if (!session || (!isSponsoredSeatsAdmin(session.accountId) && !isAdminId(session.accountId))) {
    return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 })
  }

  const payload = await getPayload({ config })
  const report = await buildShadowValidationReport(process.env, {
    adapterResult: await createShadowValidationAdapter(payload as never).load(),
  })

  return NextResponse.json({
    schemaVersion: report.evidence.schemaVersion,
    generatedAt: report.evidence.generatedAt,
    commitSha: report.evidence.commitSha,
    collectionCounts: report.evidence.collectionCounts,
    truncatedCollections: report.evidence.truncatedCollections,
    readFailures: report.evidence.readFailures,
    issues: report.evidence.issues,
    journeys: report.evidence.journeys,
    migrationOrder: report.evidence.migrationOrder,
    approvalsPresent: report.evidence.approvalsPresent,
  })
}
