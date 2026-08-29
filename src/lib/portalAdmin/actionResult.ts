// Consumed by 'use server' action adapters. Keeping the result core free of
// server-only imports allows its pure normalization contract to be unit tested.
export const PORTAL_ADMIN_ERROR_CODES = [
  'unauthorized',
  'forbidden',
  'invalid_input',
  'not_found',
  'conflict',
  'dependency_blocked',
  'rate_limited',
  'internal_error',
] as const

export type PortalAdminErrorCode = (typeof PORTAL_ADMIN_ERROR_CODES)[number]

export type PortalAdminActionErrorResult = {
  ok: false
  code: PortalAdminErrorCode
  message: string
  fieldErrors?: Record<string, string>
}

export type PortalAdminActionResult<T> =
  | { ok: true; data: T }
  | PortalAdminActionErrorResult

/**
 * Safe, expected failure raised inside a portal administrator operation.
 *
 * The error is intentionally separate from the public result so one server
 * action can normalize every expected and unexpected failure at its boundary.
 */
export class PortalAdminActionError extends Error {
  readonly code: PortalAdminErrorCode
  readonly fieldErrors?: Record<string, string>

  constructor(
    code: PortalAdminErrorCode,
    message: string,
    fieldErrors?: Record<string, string>,
  ) {
    super(message)
    this.name = 'PortalAdminActionError'
    this.code = code
    this.fieldErrors = fieldErrors
  }
}

export function success<T>(data: T): PortalAdminActionResult<T> {
  return { ok: true, data }
}

export function failure(
  code: PortalAdminErrorCode,
  message: string,
  fieldErrors?: Record<string, string>,
): PortalAdminActionErrorResult {
  return {
    ok: false,
    code,
    message,
    ...(fieldErrors ? { fieldErrors } : {}),
  }
}

/**
 * Converts an action's internal failure into the deliberately small result
 * contract exposed to the client. Unknown errors are logged server-side but
 * never expose their message, stack, or provider details to the browser.
 */
export function normalizePortalAdminError(
  error: unknown,
  actionName: string,
): PortalAdminActionErrorResult {
  if (error instanceof PortalAdminActionError) {
    return failure(error.code, error.message, error.fieldErrors)
  }

  const errorName = error instanceof Error ? error.name : ''
  const knownProviderErrors: Record<string, PortalAdminErrorCode> = {
    ValidationError: 'invalid_input',
    NotFoundError: 'not_found',
    ConflictError: 'conflict',
    ForbiddenError: 'forbidden',
    UnauthorizedError: 'unauthorized',
    RateLimitError: 'rate_limited',
  }
  const knownCode = knownProviderErrors[errorName]
  if (knownCode) {
    return failure(knownCode, publicMessageForCode(knownCode))
  }

  console.error('portal_admin_action_failed', {
    actionName,
    error: error instanceof Error ? error.stack : String(error),
  })
  return failure('internal_error', 'The request could not be completed.')
}

function publicMessageForCode(code: PortalAdminErrorCode): string {
  switch (code) {
    case 'invalid_input':
      return 'Please check the submitted information.'
    case 'not_found':
      return 'The requested record was not found.'
    case 'conflict':
      return 'The request conflicts with the current record.'
    case 'forbidden':
      return 'Administrator access is required.'
    case 'unauthorized':
      return 'Please sign in and try again.'
    case 'rate_limited':
      return 'Too many requests. Please try again shortly.'
    case 'dependency_blocked':
      return 'This operation is blocked by a related record.'
    case 'internal_error':
      return 'The request could not be completed.'
  }
}
