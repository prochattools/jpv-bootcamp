import type { MemberAccountActionService } from '@/lib/auth/memberAccountActions'
import type {
  PayloadDocument,
  PayloadMemberAuthAPI,
} from '@/lib/payloadCourse/accessService'
import { getMemberEmailVerificationSchema } from '@/lib/auth/memberEmailVerificationSql'
import { createAuditEvent, queueAndAttemptEmailEvent } from '@/lib/payloadCourse/events'
import { quotePgIdentifier } from '@/lib/payloadMigrationSchema'
import { isEligibleCurrentMember, type CurrentPayloadMember } from '@/lib/members/currentMember'

export type CompletePasswordResetInput = {
  token: string
  password: string
  passwordConfirmation: string
}

export type CompletePasswordResetResult =
  | {
      ok: true
      member: PayloadDocument
    }
  | {
      ok: false
      error: 'invalid_request' | 'password_too_short' | 'password_mismatch' | 'invalid_or_expired_token' | 'account_ineligible'
    }

async function preparePayloadPasswordResetToken(
  payload: PayloadMemberAuthAPI,
  memberId: PayloadDocument['id'],
  token: string,
): Promise<void> {
  if (!payload.db?.updateOne) {
    throw new Error('Payload db.updateOne is required for member password reset preparation')
  }

  await payload.db.updateOne({
    collection: 'payload_members',
    id: memberId,
    data: {
      resetPasswordToken: token,
      resetPasswordExpiration: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    },
  })
}

type QueryResult = {
  rows?: Array<Record<string, unknown>>
}

type QueryClient = {
  query(sql: string, values?: readonly unknown[]): Promise<QueryResult>
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function asString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return null
}

function resolveQueryClient(payload: PayloadMemberAuthAPI): QueryClient {
  const database = asRecord((payload as unknown as { db?: unknown }).db)
  const directPool = database.pool
  if (directPool && typeof directPool === 'object' && 'query' in directPool) {
    return directPool as QueryClient
  }

  const drizzle = asRecord(database.drizzle)
  const session = asRecord(drizzle.session)
  const sessionClient = session.client
  if (sessionClient && typeof sessionClient === 'object' && 'query' in sessionClient) {
    return sessionClient as QueryClient
  }

  throw new Error('Payload PostgreSQL query client is unavailable')
}

async function readPreparedResetTokenState(
  payload: PayloadMemberAuthAPI,
  memberId: PayloadDocument['id'],
  token: string,
): Promise<'prepared' | 'cleared' | 'unknown'> {
  try {
    const schemaName = getMemberEmailVerificationSchema()
    const table = `${quotePgIdentifier(schemaName)}.${quotePgIdentifier('payload_members')}`
    const result = await resolveQueryClient(payload).query(
      `SELECT "reset_password_token" FROM ${table} WHERE "id" = $1::integer LIMIT 1;`,
      [memberId],
    )
    if (!result.rows?.[0]) return 'unknown'
    const current = result.rows[0].reset_password_token
    if (current === null || current === undefined || current === '') return 'cleared'
    return typeof current === 'string' && current === token ? 'prepared' : 'unknown'
  } catch {
    return 'unknown'
  }
}

async function createPasswordChangedSecurityEvent(
  payload: PayloadMemberAuthAPI,
  memberId: PayloadDocument['id'],
): Promise<PayloadDocument> {
  try {
    return await payload.create({
      collection: 'payload_member_security_events',
      data: {
        member: memberId,
        eventType: 'password_changed',
        source: 'member_reset',
        metadata: {
          purpose: 'password_reset',
          automaticLogin: false,
        },
      },
      overrideAccess: true,
    })
  } catch {
    const schemaName = getMemberEmailVerificationSchema()
    const table = `${quotePgIdentifier(schemaName)}.${quotePgIdentifier('payload_member_security_events')}`
    const result = await resolveQueryClient(payload).query(
      `
INSERT INTO ${table} (
  "member_id",
  "event_type",
  "source",
  "metadata",
  "updated_at",
  "created_at"
)
VALUES ($1, 'password_changed', 'member_reset', $2::jsonb, now(), now())
RETURNING "id";
`,
      [
        memberId,
        JSON.stringify({
          purpose: 'password_reset',
          automaticLogin: false,
        }),
      ],
    )
    const id = asString(result.rows?.[0]?.id)
    if (!id) throw new Error('Password changed security event could not be persisted')
    return { id }
  }
}

async function queuePasswordChangedConfirmation(
  payload: PayloadMemberAuthAPI,
  input: {
    memberId: PayloadDocument['id']
    email: string
    securityEventId: PayloadDocument['id']
  },
): Promise<void> {
  const dedupeKey = `member-password-changed:${input.memberId}:${input.securityEventId}`
  const metadata = {
    memberId: String(input.memberId),
    purpose: 'password_reset_confirmation',
  }

  try {
    await queueAndAttemptEmailEvent(payload, {
      toEmail: input.email,
      templateKey: 'member-password-changed',
      dedupeKey,
      metadata,
    })
    return
  } catch {
    const schemaName = getMemberEmailVerificationSchema()
    const table = `${quotePgIdentifier(schemaName)}.${quotePgIdentifier('payload_email_events')}`
    const client = resolveQueryClient(payload)
    const existing = await client.query(
      `
SELECT "id"
FROM ${table}
WHERE "dedupe_key" = $1::varchar
LIMIT 1;
`,
      [dedupeKey],
    )
    if (existing.rows?.[0]?.id !== null && existing.rows?.[0]?.id !== undefined) return

    await client.query(
      `
INSERT INTO ${table} (
  "display_name",
  "to_email",
  "template_key",
  "delivery_status",
  "dedupe_key",
  "metadata",
  "updated_at",
  "created_at"
)
VALUES ($1::varchar, $2::varchar, 'member-password-changed', 'queued', $3::varchar, $4::jsonb, now(), now());
`,
      [
        `member-password-changed -> ${input.email}`,
        input.email,
        dedupeKey,
        JSON.stringify(metadata),
      ],
    )
  }
}

const PASSWORD_RESET_RESULT_KEY = 'password-reset-completed'

async function releasePasswordReset(
  actions: MemberAccountActionService,
  token: string,
  reservationNonce: string,
): Promise<void> {
  await actions.releaseAction(token, 'password_reset', reservationNonce).catch(() => {})
}

export async function completePasswordReset(
  payload: PayloadMemberAuthAPI,
  actions: MemberAccountActionService,
  input: CompletePasswordResetInput,
): Promise<CompletePasswordResetResult> {
  const token = input.token.trim()
  if (!token || !input.password || !input.passwordConfirmation) {
    return { ok: false, error: 'invalid_request' }
  }
  if (input.password.length < 12) return { ok: false, error: 'password_too_short' }
  if (input.password !== input.passwordConfirmation) {
    return { ok: false, error: 'password_mismatch' }
  }

  const reservation = await actions.reserveAction(token, 'password_reset')
  if (reservation.reserved === false) {
    if (
      reservation.reason === 'already_consumed' &&
      reservation.memberId &&
      actions.isCompletedResult(
        token,
        'password_reset',
        PASSWORD_RESET_RESULT_KEY,
        reservation.resultFingerprint,
      )
    ) {
      const priorMember = await payload
        .findByID({
          collection: 'payload_members',
          id: reservation.memberId,
          depth: 0,
          overrideAccess: true,
        })
        .catch((): null => null)
      if (isEligibleCurrentMember(priorMember)) {
        return { ok: true, member: priorMember }
      }
    }
    return { ok: false, error: 'invalid_or_expired_token' }
  }

  let member: CurrentPayloadMember
  try {
    member = await payload.findByID({
      collection: 'payload_members',
      id: reservation.memberId,
      depth: 0,
      overrideAccess: true,
    })
  } catch {
    await releasePasswordReset(actions, token, reservation.reservationNonce)
    return { ok: false, error: 'account_ineligible' }
  }
  if (!isEligibleCurrentMember(member)) {
    await releasePasswordReset(actions, token, reservation.reservationNonce)
    return { ok: false, error: 'account_ineligible' }
  }

  let resetCompleted = false
  let resetTokenPrepared = false

  if (reservation.reclaimed && reservation.resultFingerprint) {
    if (!actions.isCompletedResult(
      token,
      'password_reset',
      PASSWORD_RESET_RESULT_KEY,
      reservation.resultFingerprint,
    )) {
      // A reclaimed reservation with a conflicting intended result is not safely recoverable.
      return { ok: false, error: 'invalid_or_expired_token' }
    }
    const recoveredTokenState = await readPreparedResetTokenState(payload, member.id, token)
    if (recoveredTokenState === 'cleared') {
      resetCompleted = true
    } else if (recoveredTokenState === 'prepared') {
      resetTokenPrepared = true
    } else {
      // The previous worker's mutation outcome is unknown. Keep the lease for operator-visible retry.
      return { ok: false, error: 'invalid_or_expired_token' }
    }
  }

  if (!resetCompleted && !reservation.resultFingerprint) {
    const mutationMarker = await actions.markMutationStarted(
      token,
      'password_reset',
      reservation.reservationNonce,
      PASSWORD_RESET_RESULT_KEY,
    )
    if (!mutationMarker.marked) {
      await releasePasswordReset(actions, token, reservation.reservationNonce)
      return { ok: false, error: 'invalid_or_expired_token' }
    }
  }

  if (!resetCompleted && !resetTokenPrepared) {
    try {
      await preparePayloadPasswordResetToken(payload, member.id, token)
      resetTokenPrepared = true
    } catch {
      const preparedState = await readPreparedResetTokenState(payload, member.id, token)
      if (preparedState === 'prepared') {
        resetTokenPrepared = true
      } else if (preparedState === 'cleared') {
        await releasePasswordReset(actions, token, reservation.reservationNonce)
        return { ok: false, error: 'invalid_or_expired_token' }
      } else {
        // The preparation outcome is uncertain. Keep the reservation until lease expiry.
        return { ok: false, error: 'invalid_or_expired_token' }
      }
    }
  }

  if (!resetCompleted) {
    try {
      await payload.resetPassword({
        collection: 'payload_members',
        data: {
          token,
          password: input.password,
        },
        overrideAccess: true,
      })
      resetCompleted = true
    } catch {
      const tokenState = await readPreparedResetTokenState(payload, member.id, token)
      if (tokenState === 'prepared') {
        await releasePasswordReset(actions, token, reservation.reservationNonce)
        return { ok: false, error: 'invalid_or_expired_token' }
      }
      if (tokenState !== 'cleared') {
        // The downstream outcome is uncertain. Keep the reservation until lease expiry.
        return { ok: false, error: 'invalid_or_expired_token' }
      }
      resetCompleted = true
    }
  }

  if (!resetCompleted) return { ok: false, error: 'invalid_or_expired_token' }

  let updated = member
  try {
    updated = await payload.update({
      collection: 'payload_members',
      id: member.id,
      data: {
        loginAttempts: 0,
        lockUntil: null,
      },
      overrideAccess: true,
      overrideLock: true,
    })
  } catch {
    // Password reset already succeeded. Lockout cleanup remains best effort.
  }

  const completion = await actions.finalizeAction(
    token,
    'password_reset',
    reservation.reservationNonce,
    PASSWORD_RESET_RESULT_KEY,
  )
  if (!completion.finalized) {
    // Do not release after a successful password mutation. A retry can recover after lease expiry.
    return { ok: false, error: 'invalid_or_expired_token' }
  }

  let securityEvent: PayloadDocument | null = null
  try {
    securityEvent = await createPasswordChangedSecurityEvent(payload, member.id)
  } catch {
    // Durable password reset and action finalization already succeeded.
  }

  if (securityEvent) {
    try {
      await createAuditEvent(payload, {
        actorType: 'member',
        actorId: member.id,
        action: 'member.password.reset.completed',
        targetCollection: 'payload_members',
        targetId: member.id,
        metadata: {
          automaticLogin: false,
          securityEventId: String(securityEvent.id),
        },
      })
    } catch {
      // Audit metadata should not suppress the password-changed confirmation.
    }

    try {
      const email = typeof updated.email === 'string' ? updated.email : completion.email
      await queuePasswordChangedConfirmation(payload, {
        memberId: member.id,
        email,
        securityEventId: securityEvent.id,
      })
    } catch {
      try {
        await createAuditEvent(payload, {
          actorType: 'system',
          action: 'member.password.reset.confirmation_failed',
          targetCollection: 'payload_members',
          targetId: member.id,
          severity: 'warning',
          metadata: { securityEventId: String(securityEvent.id) },
        })
      } catch {
        // Confirmation delivery failures must never roll back a completed password reset.
      }
    }
  }

  return { ok: true, member: updated }
}
