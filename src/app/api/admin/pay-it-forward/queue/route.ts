import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import prisma from '@/libs/prisma'
import { isPayloadAdminIdentity } from '@/lib/admin/currentAdmin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: req.headers })
  if (!isPayloadAdminIdentity(auth.user)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  const [applications, available, members] = await Promise.all([
    prisma.sponsoredApplication.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, email: true, phone: true, message: true, createdAt: true },
    }),
    prisma.sponsoredSeat.count({ where: { tier: 'free', claimedByAccountId: null, reservedByApplicationId: null } }),
    payload.find({
      collection: 'payload_members',
      where: { accountStatus: { not_equals: 'deleted' } },
      limit: 200,
      depth: 0,
      sort: 'email',
      overrideAccess: true,
    }),
  ])

  return NextResponse.json({
    applications,
    available,
    members: members.docs.map((member) => ({ id: member.id, email: typeof member.email === 'string' ? member.email : null })),
  })
}
