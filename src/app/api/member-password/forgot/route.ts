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
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'invalid_request' }, 400)
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json({ ok: false, error: 'invalid_request' }, 400)
  }

  const email = (body as { email?: unknown }).email
  if (typeof email !== 'string' || email.trim().length < 3 || email.length > 320) {
    return json({ ok: true, message: GENERIC_MESSAGE })
  }

  try {
    const { payload, service } = await getPayloadMemberAccountActionContext()
    const result = await requestPasswordReset(payload, service, { email })
    return json({ ok: true, message: result.message })
  } catch {
    return json({ ok: true, message: GENERIC_MESSAGE })
  }
}
