import { NextRequest, NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import {
  getReactionSummary,
  ReactionServiceError,
  reactionTargetKinds,
  reactionTypes,
  setReaction,
  type PayloadReactionWriteAPI,
  type ReactionTargetKind,
  type ReactionType,
} from '@/lib/payloadCourse/reactions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await resolvePayloadRequestSession(request.headers)
  if (!session.member?.id) {
    return NextResponse.json({ ok: false, message: 'Please sign in again.' }, { status: 401 })
  }

  try {
    const body = await request.json() as Record<string, unknown>
    const targetKind = body.targetKind
    const targetId = typeof body.targetId === 'string' || typeof body.targetId === 'number' ? body.targetId : ''
    const reactionType = body.reactionType

    if (!reactionTargetKinds.includes(targetKind as ReactionTargetKind) || !String(targetId).trim() || !reactionTypes.includes(reactionType as ReactionType)) {
      return NextResponse.json({ ok: false, message: 'Invalid reaction request.' }, { status: 400 })
    }

    const payload = await getPayload({ config }) as unknown as PayloadReactionWriteAPI
    const memberId = String(session.member.id)
    await setReaction(payload, memberId, { kind: targetKind as ReactionTargetKind, id: targetId }, reactionType)
    const summary = await getReactionSummary(payload, memberId, { kind: targetKind as ReactionTargetKind, id: targetId })

    return NextResponse.json({ ok: true, summary })
  } catch (error) {
    const code = error instanceof ReactionServiceError ? error.code : 'service_unavailable'
    const status = ['target_not_found', 'target_inaccessible', 'target_hidden', 'target_not_supported', 'invalid_reaction', 'rate_limited'].includes(code) ? 400 : 500
    return NextResponse.json({ ok: false, message: error instanceof ReactionServiceError ? error.message : 'Unable to save this reaction.' }, { status })
  }
}
