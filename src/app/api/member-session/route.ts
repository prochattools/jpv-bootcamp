import { headers } from 'next/headers'
import { NextResponse } from 'next/server'

import { resolvePayloadRequestSession } from '@/lib/auth/payloadSession'
import { decideSharedLogin } from '@/lib/auth/sharedLoginDecision'

function mapDeniedReason(reason: string): 'verification_required' | 'account_unavailable' | 'unauthenticated' {
  if (reason === 'member_email_unverified') return 'verification_required'
  if (reason === 'no_authenticated_identity') return 'unauthenticated'
  return 'account_unavailable'
}

export async function GET(request: Request) {
  try {
    const requestHeaders = await headers()
    const requestUrl = new URL(request.url)
    const requestedDestination = requestUrl.searchParams.get('next')
    const session = await resolvePayloadRequestSession(requestHeaders)
    const decision = decideSharedLogin(session, requestedDestination)

    if (
      decision.allowed &&
      decision.identity.kind === 'member' &&
      decision.destination &&
      (decision.destination === '/portal' || decision.destination.startsWith('/portal/'))
    ) {
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
