import type {
  VerificationCompletionResult,
  VerificationRequestResult,
} from './memberEmailVerification'
import { readBoundedJsonObject, routeThrottle } from './accountActionRouteSafety'

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
  const parsed = await readBoundedJsonObject(request)
  if (parsed.ok === false) {
    return jsonResponse({ accepted: false, message: 'Invalid request.' }, parsed.status)
  }

  const email = parsed.body.email
  if (typeof email !== 'string' || email.trim().length < 3 || email.length > 320) {
    return jsonResponse({ accepted: false, message: 'Invalid request.' }, 400)
  }

  const throttle = routeThrottle(request, {
    scope: 'member-email-verification-resend',
    identity: email,
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
  })
  if (!throttle.allowed) {
    return jsonResponse({ accepted: true, message: GENERIC_VERIFICATION_REQUEST_MESSAGE })
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
