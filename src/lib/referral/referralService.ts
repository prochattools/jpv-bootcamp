const REFERRAL_CODE_MAX_LENGTH = 60

export type ReferralApplicationInput = {
  name: string
  email: string
  phone?: string
  message?: string
  consentAccepted: boolean
}

export type ReferralApplicationResult =
  | { status: 'pending_review'; reference: string }
  | { status: 'validation_failed'; errors: string[] }

function sanitizeReferralCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.length > REFERRAL_CODE_MAX_LENGTH) return null
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return null
  return trimmed
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateName(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Name is required.'
  if (trimmed.length < 1) return 'Name is required.'
  if (trimmed.length > 120) return 'Name is too long.'
  return null
}

function validateEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return 'Email is required.'
  if (trimmed.length > 254) return 'Email is too long.'
  if (!emailRegex.test(trimmed)) return 'Email is not valid.'
  return null
}

function validateConsent(value: boolean): string | null {
  if (!value) return 'Consent is required.'
  return null
}

function generateReference(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `REF-${timestamp}-${random}`
}

export function parseReferralCode(raw: string | null | undefined): string | null {
  return sanitizeReferralCode(raw)
}

export function validateApplication(input: ReferralApplicationInput): ReferralApplicationResult {
  const errors: string[] = []

  const nameError = validateName(input.name)
  if (nameError) errors.push(nameError)

  const emailError = validateEmail(input.email)
  if (emailError) errors.push(emailError)

  const consentError = validateConsent(input.consentAccepted)
  if (consentError) errors.push(consentError)

  if (errors.length > 0) {
    return { status: 'validation_failed', errors }
  }

  return {
    status: 'pending_review',
    reference: generateReference(),
  }
}