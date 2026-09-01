import { NextResponse } from 'next/server'

import { resolvePortalRequestMember } from '@/lib/auth/resolvePortalRequestMember'
import { toggleMemberFollow } from '@/lib/payloadCourse/memberFollows'

type RouteContext = { params: Promise<{ memberId: string }> }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request, { params }: RouteContext) {
  const viewer = await resolvePortalRequestMember(request.headers)
  if (!viewer) return NextResponse.json({ ok: false, message: 'Please sign in again.' }, { status: 401 })

  const { memberId } = await params
  if (!/^\d+$/.test(memberId)) return NextResponse.json({ ok: false, message: 'That member profile was not found.' }, { status: 404 })
  if (viewer.memberId === memberId) return NextResponse.json({ ok: false, message: 'You cannot follow yourself.' }, { status: 400 })

  const target = await viewer.payload.findByID({ collection: 'payload_members', id: memberId, depth: 0, overrideAccess: true }).catch((): null => null)
  if (!target || target.accountStatus !== 'active') return NextResponse.json({ ok: false, message: 'That member profile was not found.' }, { status: 404 })

  try {
    const follow = await toggleMemberFollow(viewer.payload, viewer.memberId, memberId)
    return NextResponse.json({ ok: true, follow })
  } catch (error) {
    console.error('[member follow] error:', error instanceof Error ? error.message : String(error))
    return NextResponse.json({ ok: false, message: 'Unable to update the follow status right now.' }, { status: 500 })
  }
}
