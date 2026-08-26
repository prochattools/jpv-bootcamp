import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import config from '@payload-config'
import { getPayload } from 'payload'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { decideSharedLogin } from '@/lib/auth/sharedLoginDecision'
import { resolveMemberDestination } from '@/lib/auth/memberLoginFlow'

function mapDeniedReason(reason: string): 'verification_required' | 'account_unavailable' | 'unauthenticated' {
  if (reason === 'member_email_unverified') return 'verification_required'
  if (reason === 'no_authenticated_identity') return 'unauthenticated'
  return 'account_unavailable'
}

async function recordMemberLogin(memberId: string | number): Promise<void> {
  try {
    const payload = await getPayload({ config })
    if (!payload.db?.updateOne) return
    await payload.db.updateOne({
      collection: 'payload_members',
      id: memberId,
      data: {
        lastLoginAt: new Date().toISOString(),
      },
    })
  } catch {
    // Login metadata should not block an otherwise valid member session.
  }
}

export async function GET(request: Request) {
  try {
    const requestHeaders = await headers()
    const requestUrl = new URL(request.url)
    const requestedDestination = requestUrl.searchParams.get('next')
    const session = await resolvePayloadRequestSession(requestHeaders)

    // The portal is a shared entry point. Payload administrators authenticate
    // through payload_users but must still be able to land in the member portal
    // with their administrator identity intact. requirePortalAccess performs
    // the server-side administrator check and provisions the linked member
    // identity when the portal route is reached.
    if (session.administratorId && !session.unresolvedCollection) {
      return NextResponse.json({
        allowed: true,
        destination: resolveMemberDestination(requestedDestination),
      })
    }

    const decision = decideSharedLogin(session, requestedDestination)

    if (
      decision.allowed &&
      decision.identity.kind === 'member' &&
      session.member &&
      decision.destination &&
      (decision.destination === '/portal' || decision.destination.startsWith('/portal/'))
    ) {
      await recordMemberLogin(session.member.id)
      return NextResponse.json({
        allowed: true,
        destination: decision.destination,
      })
    }

    return NextResponse.json(
      {
        allowed: false,
        reason: mapDeniedReason(decision.reason),
      },
      { status: 403 },
    )
  } catch {
    return NextResponse.json(
      {
        allowed: false,
        reason: 'account_unavailable',
      },
      { status: 503 },
    )
  }
}
