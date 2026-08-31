import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { attachOperationalBillingFallback } from '@/lib/payloadCourse/operationalBillingFallback'
import {
  getReactionSummary,
  ReactionServiceError,
  setReaction,
  type PayloadReactionWriteAPI,
  type ReactionTargetKind,
  type ReactionType,
} from '@/lib/payloadCourse/reactions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const targetKinds = new Set<ReactionTargetKind>(['space_post', 'space_comment', 'lesson_comment', 'content_post', 'content_page'])
const reactionTypes = new Set<ReactionType>(['helpful', 'insightful', 'celebrate'])

export async function POST(req: NextRequest) {
  const session = await resolvePayloadRequestSession(req.headers)
  if (!session.member?.id) return NextResponse.json({ ok: false, message: 'Please sign in again.' }, { status: 401 })

  try {
    const body = (await req.json()) as Record<string, unknown>
    const targetKind = body.targetKind
    const targetId = typeof body.targetId === 'string' || typeof body.targetId === 'number' ? body.targetId : ''
    const reactionType = body.reactionType
    if (!targetKinds.has(targetKind as ReactionTargetKind) || !targetId || !reactionTypes.has(reactionType as ReactionType)) {
      return NextResponse.json({ ok: false, message: 'Invalid reaction request.' }, { status: 400 })
    }

    const payload = attachOperationalBillingFallback(
      (await getPayload({ config })) as unknown as PayloadReactionWriteAPI,
    )
    await setReaction(payload, String(session.member.id), { kind: targetKind as ReactionTargetKind, id: targetId }, reactionType)
    const summary = await getReactionSummary(payload, String(session.member.id), { kind: targetKind as ReactionTargetKind, id: targetId })
    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    if (!(error instanceof ReactionServiceError)) {
      console.error('JPV_REACTION_ROUTE_FAILED', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
    const status = error instanceof ReactionServiceError
      ? error.code === 'unauthenticated'
        ? 401
        : error.code === 'rate_limited'
          ? 429
          : error.code === 'conflict'
            ? 409
            : error.code === 'service_unavailable'
              ? 503
              : ['target_not_found', 'target_inaccessible', 'target_hidden', 'target_not_supported', 'ineligible', 'invalid_reaction'].includes(error.code)
                ? 400
                : 500
      : 500
    return NextResponse.json({ ok: false, message: error instanceof ReactionServiceError ? error.message : 'Unable to save this reaction.' }, { status })
  }
}
