import type {
  PayloadDocument,
  PayloadMemberAuthAPI,
} from '@/lib/payloadCourse/accessService'

export type CompletePasswordResetInput = {
  token: string
  password: string
  passwordConfirmation: string
}

export type CompletePasswordResetResult =
  | {
      ok: true
      member: PayloadDocument | null
    }
  | {
      ok: false
      error: 'invalid_request' | 'password_too_short' | 'password_mismatch' | 'invalid_or_expired_token'
    }

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null
  return value as Record<string, unknown>
}

function memberFromResetResult(value: unknown): PayloadDocument | null {
  const result = asRecord(value)
  if (!result) return null

  const candidate = asRecord(result.user) ?? asRecord(result.doc)
  if (!candidate || candidate.id === null || candidate.id === undefined) return null

  return candidate as PayloadDocument
}

export async function completePasswordReset(
  payload: PayloadMemberAuthAPI,
  input: CompletePasswordResetInput,
): Promise<CompletePasswordResetResult> {
  const token = input.token.trim()
  if (!token || !input.password || !input.passwordConfirmation) {
    return { ok: false, error: 'invalid_request' }
  }

  if (input.password.length < 12) {
    return { ok: false, error: 'password_too_short' }
  }

  if (input.password !== input.passwordConfirmation) {
    return { ok: false, error: 'password_mismatch' }
  }

  try {
    const result = await payload.resetPassword({
      collection: 'payload_members',
      data: {
        password: input.password,
        token,
      },
    })

    const member = memberFromResetResult(result)
    if (member) {
      await payload.create({
        collection: 'payload_member_security_events',
        data: {
          member: member.id,
          eventType: 'password_changed',
          source: 'member_reset',
          metadata: {
            purpose: 'password_reset',
          },
        },
        overrideAccess: true,
      })
    }

    return {
      ok: true,
      member,
    }
  } catch {
    return { ok: false, error: 'invalid_or_expired_token' }
  }
}
