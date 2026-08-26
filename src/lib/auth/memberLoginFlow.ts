export const TEMPORARY_MEMBER_LOGIN_ERROR =
  'Sign-in is temporarily unavailable. Please try again shortly.'
export const GENERIC_MEMBER_LOGIN_ERROR =
  'The email or password provided is incorrect, or this account cannot sign in.'
export const UNAVAILABLE_MEMBER_LOGIN_ERROR =
  'This account cannot sign in at the moment. Please contact support.'
export const VERIFICATION_MEMBER_LOGIN_ERROR =
  'Please verify your email before signing in.'
export const MEMBER_LOGIN_PAGE_ANONYMOUS_MESSAGE =
  'Choose the secure area that matches your account.'
export const MEMBER_LOGIN_PAGE_DENIED_MESSAGE =
  'We could not safely continue this session. Sign out and try again, or contact support.'

export type MemberSessionDecision =
  | { allowed: true; destination: string }
  | {
      allowed: false
      reason: 'verification_required' | 'account_unavailable' | 'unauthenticated' | 'malformed'
    }

export type MemberLoginPageStatus =
  | 'anonymous'
  | 'verification_required'
  | 'denied'
  | 'unavailable'

export function resolveMemberDestination(value: string | null | undefined): string {
  if (!value) return '/portal'

  const candidate = value.trim()
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) {
    return '/portal'
  }

  try {
    decodeURIComponent(candidate)
  } catch {
    return '/portal'
  }

  return candidate === '/portal' || candidate.startsWith('/portal/') ? candidate : '/portal'
}

export function parseMemberSessionResponse(value: unknown): MemberSessionDecision {
  if (!value || typeof value !== 'object') {
    return { allowed: false, reason: 'malformed' }
  }

  const response = value as { allowed?: unknown; destination?: unknown; reason?: unknown }

  if (response.allowed === true && typeof response.destination === 'string') {
    const destination = resolveMemberDestination(response.destination)
    if (destination === response.destination) {
      return { allowed: true, destination }
    }
    return { allowed: false, reason: 'malformed' }
  }

  if (response.allowed === false) {
    if (response.reason === 'verification_required') {
      return { allowed: false, reason: 'verification_required' }
    }
    if (response.reason === 'account_unavailable') {
      return { allowed: false, reason: 'account_unavailable' }
    }
    if (response.reason === 'unauthenticated') {
      return { allowed: false, reason: 'unauthenticated' }
    }
  }

  return { allowed: false, reason: 'malformed' }
}

export function getMemberLoginErrorMessage(decision: MemberSessionDecision): string {
  if (decision.allowed === true) return GENERIC_MEMBER_LOGIN_ERROR
  if (decision.reason === 'verification_required') return VERIFICATION_MEMBER_LOGIN_ERROR
  if (decision.reason === 'account_unavailable') return UNAVAILABLE_MEMBER_LOGIN_ERROR
  return GENERIC_MEMBER_LOGIN_ERROR
}

export function shouldClearDeniedMemberSession(decision: MemberSessionDecision): boolean {
  return !decision.allowed
}

export function getMemberLoginPageMessage(status: MemberLoginPageStatus): string {
  if (status === 'anonymous') return MEMBER_LOGIN_PAGE_ANONYMOUS_MESSAGE
  if (status === 'verification_required') return VERIFICATION_MEMBER_LOGIN_ERROR
  if (status === 'unavailable') return TEMPORARY_MEMBER_LOGIN_ERROR
  return MEMBER_LOGIN_PAGE_DENIED_MESSAGE
}
