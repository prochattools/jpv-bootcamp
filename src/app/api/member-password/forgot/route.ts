import { readBoundedJsonObject, routeThrottle } from '@/lib/auth/accountActionRouteSafety'
import { getPayloadMemberAccountActionContext } from '@/lib/auth/memberAccountActionApplication'
import { requestPasswordReset } from '@/lib/members/requestPasswordReset'

export const dynamic = 'force-dynamic'

const GENERIC_MESSAGE = 'If an eligible account exists, password reset instructions have been sent.'

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: Request): Promise<Response> {
  const parsed = await readBoundedJsonObject(request)
  if (parsed.ok === false) return json({ ok: false, error: parsed.error }, parsed.status)

  const email = parsed.body.email
  if (typeof email !== 'string' || email.trim().length < 3 || email.length > 320) {
    return json({ ok: true, message: GENERIC_MESSAGE })
  }

  const throttle = routeThrottle(request, {
    scope: 'member-password-forgot',
    identity: email,
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  })
  if (!throttle.allowed) return json({ ok: true, message: GENERIC_MESSAGE })

  try {
    const { payload, service } = await getPayloadMemberAccountActionContext()
    const result = await requestPasswordReset(payload, service, { email })
    return json({ ok: true, message: result.message })
  } catch {
    return json({ ok: true, message: GENERIC_MESSAGE })
  }
}
