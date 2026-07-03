import { readBoundedJsonObject, routeThrottle, sameOriginRequest } from '@/lib/auth/accountActionRouteSafety'
import { getPayloadMemberEmailVerificationService } from '@/lib/auth/memberEmailVerificationApplication'
import { registerFreeMember } from '@/lib/members/registerFreeMember'

export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request): Promise<Response> {
  if (!sameOriginRequest(request)) return json({ ok: false, error: 'forbidden' }, 403)

  const parsed = await readBoundedJsonObject(request)
  if (parsed.ok === false) return json({ ok: false, error: parsed.error }, parsed.status)

  const throttle = routeThrottle(request, {
    scope: 'member-registration',
    identity: typeof parsed.body.email === 'string' ? parsed.body.email : 'anonymous',
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  })
  if (!throttle.allowed) {
    return json({ ok: true, message: 'If an eligible account exists, verification instructions will be sent.' })
  }

  try {
    const { getPayload } = await import('payload')
    const { default: config } = await import('@/payload.config')
    const payload = await getPayload({ config })
    const verification = await getPayloadMemberEmailVerificationService()
    const result = await registerFreeMember(
      payload as never,
      verification,
      request,
      {
        firstName: String(parsed.body.firstName ?? ''),
        lastName: String(parsed.body.lastName ?? ''),
        email: String(parsed.body.email ?? ''),
        password: String(parsed.body.password ?? ''),
        passwordConfirmation: String(parsed.body.passwordConfirmation ?? ''),
        acceptedTerms: parsed.body.acceptedTerms === true,
        termsVersion: '2026-07',
      },
    )

    if (result.ok) {
      return json({ ok: true, message: result.message })
    }
    const failure = result as Extract<typeof result, { ok: false }>
    return json({ ok: false, error: failure.error }, failure.status)
  } catch {
    return json({ ok: true, message: 'If an eligible account exists, verification instructions will be sent.' })
  }
}
