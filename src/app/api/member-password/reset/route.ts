import { readBoundedJsonObject } from '@/lib/auth/accountActionRouteSafety'
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
  const parsed = await readBoundedJsonObject(request)
  if (parsed.ok === false) return json({ ok: false, error: parsed.error }, parsed.status)

  const record = parsed.body
  const token = stringField(record, 'token')
  if (!token || token.length < 20 || token.length > 512) {
    return json({ ok: false, error: 'invalid_or_expired_token' }, 400)
  }
  if (stringField(record, 'password').length > 256 || stringField(record, 'passwordConfirmation').length > 256) {
    return json({ ok: false, error: 'invalid_request' }, 400)
  }

  try {
    const { payload, service } = await getPayloadMemberAccountActionContext()
    const result = await completePasswordReset(payload, service, {
      token,
      password: stringField(record, 'password'),
      passwordConfirmation: stringField(record, 'passwordConfirmation'),
    })

    if (result.ok === true) return json({ ok: true, destination: '/portal?mode=login' })
    const status = result.error === 'invalid_request' ? 400 : 200
    return json({ ok: false, error: result.error }, status)
  } catch {
    return json({ ok: false, error: 'invalid_or_expired_token' }, 200)
  }
}
