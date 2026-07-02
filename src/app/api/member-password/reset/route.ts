import { getPayloadMemberAccountActionContext } from '@/lib/auth/memberAccountActionApplication'
import { completePasswordReset } from '@/lib/members/completePasswordReset'

export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function stringField(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  return typeof value === 'string' ? value : ''
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

  const record = body as Record<string, unknown>
  const token = stringField(record, 'token')
  if (!token || token.length < 20 || token.length > 512) {
    return json({ ok: false, error: 'invalid_or_expired_token' }, 400)
  }

  try {
    const { payload, service } = await getPayloadMemberAccountActionContext()
    const result = await completePasswordReset(payload, service, {
      token,
      password: stringField(record, 'password'),
      passwordConfirmation: stringField(record, 'passwordConfirmation'),
    })

    if (result.ok === true) return json({ ok: true, destination: '/login' })
    const status = result.error === 'invalid_request' ? 400 : 200
    return json({ ok: false, error: result.error }, status)
  } catch {
    return json({ ok: false, error: 'invalid_or_expired_token' }, 200)
  }
}
