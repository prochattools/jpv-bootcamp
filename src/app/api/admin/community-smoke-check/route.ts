/**
 * Staging diagnostic endpoint for community post submission path.
 * Admin-auth-gated. Returns exact access decision chain and DB state for
 * the staging member so PORTAL-010 submission errors can be diagnosed.
 *
 * Remove after PORTAL-010 community post smoke is fully GO.
 */
import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import type { PayloadCourseAccessAPI } from '@/lib/payloadCourse/accessService'
import { evaluatePayloadSpaceAccess } from '@/lib/payloadCourse/accessService'
import { getMemberCommunitySpaceDetail } from '@/lib/payloadCourse/communityPortal'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await resolvePayloadRequestSession(req.headers)
  if (!session.administratorId) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  const payload = await getPayload({ config })
  const spaceSlug = 'pro-community'

  const memberEmail = process.env.STAGING_MEMBER_EMAIL?.trim()
  if (!memberEmail) {
    return NextResponse.json({ ok: false, reason: 'STAGING_MEMBER_EMAIL_not_set' }, { status: 500 })
  }

  const memberResult = await payload.find({
    collection: 'payload_members',
    where: { email: { equals: memberEmail } },
    limit: 1,
    overrideAccess: true,
  })

  const member = memberResult.docs[0] as unknown as Record<string, unknown> | undefined
  if (!member) {
    return NextResponse.json({ ok: false, reason: 'member_not_found', email: memberEmail }, { status: 404 })
  }

  const memberId = String(member.id)

  const spaceResult = await payload.find({
    collection: 'payload_spaces',
    where: { and: [{ slug: { equals: spaceSlug } }, { status: { equals: 'published' } }] },
    limit: 1,
    overrideAccess: true,
  })
  const space = spaceResult.docs[0] as unknown as Record<string, unknown> | undefined

  const membershipResult = space ? await payload.find({
    collection: 'payload_space_memberships',
    where: { and: [{ member: { equals: memberId } }, { space: { equals: String(space.id) } }] },
    limit: 1,
    overrideAccess: true,
  }) : null
  const membership = (membershipResult?.docs[0] as unknown as Record<string, unknown> | undefined) ?? null

  let accessDecision: unknown = null
  let accessError: string | null = null
  if (space) {
    try {
      const result = await evaluatePayloadSpaceAccess(payload as unknown as PayloadCourseAccessAPI, {
        memberId,
        spaceId: space.id as string | number,
      })
      accessDecision = result.decision
    } catch (err) {
      accessError = err instanceof Error ? err.message : String(err)
    }
  }

  let detail: unknown = null
  let detailError: string | null = null
  try {
    detail = await getMemberCommunitySpaceDetail(
      payload as unknown as PayloadCourseAccessAPI,
      memberId,
      spaceSlug,
    )
  } catch (err) {
    detailError = err instanceof Error ? err.message : String(err)
  }

  const subscriptionResult = await payload.find({
    collection: 'payload_subscriptions',
    where: { member: { equals: memberId } },
    limit: 5,
    overrideAccess: true,
  })

  const detailRecord = detail as (Record<string, unknown> & { allowed?: boolean; membership?: Record<string, unknown> | null; id?: string }) | null

  return NextResponse.json({
    ok: true,
    memberId,
    memberEmail,
    memberAccountStatus: member.accountStatus,
    spaceFound: Boolean(space),
    spaceId: space ? String(space.id) : null,
    spaceStatus: space ? space.status : null,
    membershipFound: Boolean(membership),
    membershipRole: membership ? membership.role : null,
    membershipStatus: membership ? membership.status : null,
    accessDecision,
    accessError,
    detailFound: Boolean(detail),
    detailAllowed: detailRecord?.allowed ?? null,
    detailMembership: detailRecord?.membership ?? null,
    detailSpaceId: detailRecord?.id ?? null,
    canSubmit: detailRecord?.allowed === true && detailRecord.membership != null && (detailRecord.membership as Record<string, unknown>).status === 'active',
    detailError,
    subscriptions: subscriptionResult.docs.map((s) => {
      const sub = s as unknown as Record<string, unknown>
      return { id: sub.id, plan: sub.plan, status: sub.status }
    }),
  })
}
