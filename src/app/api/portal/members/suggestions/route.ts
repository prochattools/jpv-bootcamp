import { NextResponse } from 'next/server'

import { resolvePortalRequestMember } from '@/lib/auth/resolvePortalRequestMember'
import { listActiveMembers } from '@/lib/payloadCourse/memberDirectory'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const viewer = await resolvePortalRequestMember(request.headers)
  if (!viewer) return NextResponse.json({ ok: false, message: 'Please sign in again.' }, { status: 401 })
  const query = new URL(request.url).searchParams.get('q')?.trim().toLocaleLowerCase() ?? ''
  if (!query) return NextResponse.json({ ok: true, members: [] })

  const members = await listActiveMembers(viewer.payload)
  return NextResponse.json({
    ok: true,
    members: members
      .filter((member) => member.displayName.toLocaleLowerCase().includes(query))
      .slice(0, 8)
      .map((member) => ({
        memberId: member.memberId,
        displayName: member.displayName,
        ...(viewer.isAdministrator ? { email: member.email } : {}),
      })),
  })
}
