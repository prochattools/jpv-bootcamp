import type { PayloadDocument } from '@/lib/payloadCourse/accessService'

export type SafeVerificationSupportStatus = {
  memberId: string
  email: string | null
  emailVerifiedAt: string | null
  accountStatus: string | null
  lastRequestAt: string | null
  activeVerification: boolean
  cooldownActive: boolean
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function asIso(value: unknown): string | null {
  const raw = asString(value)
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function summarizeVerificationSupportStatus(input: {
  member: PayloadDocument
  activeToken?: PayloadDocument | null
  cooldownMs?: number
  now?: Date
}): SafeVerificationSupportStatus {
  const now = input.now ?? new Date()
  const lastRequestAt = asIso(input.activeToken?.lastSentAt ?? input.activeToken?.createdAt)
  const activeVerification = Boolean(
    input.activeToken &&
      !input.activeToken.consumedAt &&
      !input.activeToken.invalidatedAt &&
      asIso(input.activeToken.expiresAt) &&
      Date.parse(String(input.activeToken.expiresAt)) > now.getTime(),
  )
  const cooldownMs = input.cooldownMs ?? 5 * 60 * 1000
  const cooldownActive =
    Boolean(lastRequestAt) && now.getTime() - Date.parse(lastRequestAt as string) < cooldownMs

  return {
    memberId: String(input.member.id),
    email: asString(input.member.email),
    emailVerifiedAt: asIso(input.member.emailVerifiedAt),
    accountStatus: asString(input.member.accountStatus),
    lastRequestAt,
    activeVerification,
    cooldownActive,
  }
}

