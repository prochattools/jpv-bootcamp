import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'

import config from '@payload-config'
import { isPayloadAdminIdentity } from '@/lib/admin/currentAdmin'
import { grantSponsoredApplication, type SponsoredGrantMode } from '@/lib/sponsored-admin-grant'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type GrantInput = {
  applicationId?: string
  mode?: SponsoredGrantMode
  memberId?: string
}

async function parseInput(req: NextRequest): Promise<GrantInput> {
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) return (await req.json()) as GrantInput
  const form = await req.formData()
  return {
    applicationId: form.get('applicationId')?.toString(),
    mode: form.get('mode')?.toString() as SponsoredGrantMode | undefined,
    memberId: form.get('memberId')?.toString(),
  }
}

function redirectBack(req: NextRequest, result: string) {
  const url = new URL('/admin/collections/payload_pay_it_forward_funding', req.url)
  url.searchParams.set('sponsored', result)
  return NextResponse.redirect(url, 303)
}

export async function POST(req: NextRequest) {
  const payload = await getPayload({ config })
  const auth = await payload.auth({ headers: req.headers })
  if (!isPayloadAdminIdentity(auth.user)) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })
  }

  const input = await parseInput(req)
  if (!input.applicationId || (input.mode !== 'new' && input.mode !== 'existing')) {
    return req.headers.get('accept')?.includes('text/html')
      ? redirectBack(req, 'invalid_request')
      : NextResponse.json({ ok: false, reason: 'invalid_request' }, { status: 400 })
  }

  const result = await grantSponsoredApplication({
    payload,
    applicationId: input.applicationId,
    mode: input.mode,
    memberId: input.memberId,
    administratorId: auth.user.id,
  })

  if (req.headers.get('accept')?.includes('text/html')) {
		return redirectBack(req, result.ok ? 'checkout_sent' : ('reason' in result ? result.reason : 'grant_failed'))
  }

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
