import type {
  VerificationCompletionResult,
  VerificationRequestResult,
} from './memberEmailVerification'

export const GENERIC_VERIFICATION_REQUEST_MESSAGE =
  'If an eligible account exists, a verification email will be sent shortly.'

type MemberEmailVerificationHttpService = {
  requestVerification(email: string): Promise<VerificationRequestResult>
  completeVerification(token: string): Promise<VerificationCompletionResult>
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function handleMemberEmailVerificationResend(
  request: Request,
  service: MemberEmailVerificationHttpService,
): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return jsonResponse({ accepted: false, message: 'Invalid request.' }, 400)
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return jsonResponse({ accepted: false, message: 'Invalid request.' }, 400)
  }

  const email = (body as { email?: unknown }).email
  if (typeof email !== 'string' || email.trim().length < 3 || email.length > 320) {
    return jsonResponse({ accepted: false, message: 'Invalid request.' }, 400)
  }

  try {
    const result = await service.requestVerification(email)
    return jsonResponse(result)
  } catch {
    return jsonResponse({ accepted: true, message: GENERIC_VERIFICATION_REQUEST_MESSAGE })
  }
}

function loginResultUrl(request: Request, result: 'success' | 'used' | 'invalid'): URL {
  const url = new URL('/login', request.url)
  url.searchParams.set('verification', result)
  return url
}

export async function handleMemberEmailVerificationComplete(
  request: Request,
  service: MemberEmailVerificationHttpService,
): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token')
  if (!token || token.length < 20 || token.length > 512) {
    return Response.redirect(loginResultUrl(request, 'invalid'), 303)
  }

  try {
    const result = await service.completeVerification(token)
    if (result.verified === true) {
      return Response.redirect(loginResultUrl(request, 'success'), 303)
    }
    return Response.redirect(
      loginResultUrl(request, result.reason === 'already_used' ? 'used' : 'invalid'),
      303,
    )
  } catch {
    return Response.redirect(loginResultUrl(request, 'invalid'), 303)
  }
}
