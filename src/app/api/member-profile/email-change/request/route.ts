import {
  readBoundedJsonObject,
  routeThrottle,
  sameOriginRequest,
} from '@/lib/auth/accountActionRouteSafety'
import { getPayloadMemberAccountActionContext } from '@/lib/auth/memberAccountActionApplication'
import { requestMemberEmailChange } from '@/lib/members/changeMemberEmail'
import { getCurrentPayloadMember } from '@/lib/members/currentMember'
import type { PayloadMemberAuthAPI } from '@/lib/payloadCourse/accessService'

export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: Request): Promise<Response> {
  if (!sameOriginRequest(request)) return json({ ok: false, error: 'forbidden' }, 403)

  const parsed = await readBoundedJsonObject(request)
  if (parsed.ok === false) return json({ ok: false, error: parsed.error }, parsed.status)

  const newEmail = parsed.body.newEmail
  if (typeof newEmail !== 'string' || newEmail.trim().length < 3 || newEmail.length > 320) {
    return json({ ok: false, error: 'invalid_email' }, 400)
  }

  const { member, payload } = await getCurrentPayloadMember()
  if (!member || typeof member.email !== 'string') {
    return json({ ok: false, error: 'unauthenticated' }, 401)
  }

  const throttle = routeThrottle(request, {
    scope: 'member-email-change-request',
    identity: `${member.id}:${newEmail}`,
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  })
  if (!throttle.allowed) {
    return json({
      ok: true,
      message:
        'Check the new email address for a confirmation link. Your current sign-in email remains active until confirmation.',
    })
  }

  try {
    const { service, publicBaseUrl } = await getPayloadMemberAccountActionContext()
    const result = await requestMemberEmailChange(payload as unknown as PayloadMemberAuthAPI, service, {
      memberId: member.id,
      currentEmail: member.email,
      newEmail,
      displayName: member.email.split('@')[0] || 'Member',
      baseUrl: publicBaseUrl,
    })

    if (result.ok === true) {
      return json({
        ok: true,
        message:
          'Check the new email address for a confirmation link. Your current sign-in email remains active until confirmation.',
      })
    }

    return json({ ok: false, error: result.error }, result.error === 'invalid_email' ? 400 : 200)
  } catch {
    return json({ ok: false, error: 'account_unavailable' }, 200)
  }
}
