const SUPPORT_CODE_MAX_LENGTH = 60
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type SponsorIntentInput = {
  name: string
  email: string
  message?: string
}

export type RecipientApplicationInput = {
  name: string
  email: string
  reason: string
  consentAccepted: boolean
}

export type SponsorIntentResult =
  | { status: 'manual_follow_up'; reference: string }
  | { status: 'validation_failed'; errors: string[] }

export type RecipientApplicationResult =
  | { status: 'pending_review'; reference: string }
  | { status: 'validation_failed'; errors: string[] }

function validateName(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return 'Name is required.'
  if (trimmed.length > 120) return 'Name is too long.'
  return null
}

function validateEmail(value: string): string | null {
  const trimmed = value.trim().toLowerCase()
  if (!trimmed) return 'Email is required.'
  if (trimmed.length > 254) return 'Email is too long.'
  if (!EMAIL_REGEX.test(trimmed)) return 'Email is not valid.'
  return null
}

function validateConsent(value: boolean): string | null {
  if (!value) return 'Consent is required.'
  return null
}

function validateRequiredText(value: string, label: string, maxLength: number): string | null {
  const trimmed = value.trim()
  if (!trimmed) return `${label} is required.`
  if (trimmed.length > maxLength) return `${label} is too long.`
  return null
}

function generateReference(prefix: string): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `${prefix}-${timestamp}-${random}`
}

export function parseSupportCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.length > SUPPORT_CODE_MAX_LENGTH) return null
  if (!/^[A-Za-z0-9._-]+$/.test(trimmed)) return null
  return trimmed
}

export function validateSponsorIntent(input: SponsorIntentInput): SponsorIntentResult {
  const errors: string[] = []

  const nameError = validateName(input.name)
  if (nameError) errors.push(nameError)

  const emailError = validateEmail(input.email)
  if (emailError) errors.push(emailError)

  if (input.message !== undefined && input.message !== null) {
    const msgError = validateRequiredText(input.message ?? '', 'Message', 1200)
    if (msgError && input.message.trim()) errors.push(msgError)
  }

  if (errors.length > 0) {
    return { status: 'validation_failed', errors }
  }

  return {
    status: 'manual_follow_up',
    reference: generateReference('SPN'),
  }
}

export function validateRecipientApplication(input: RecipientApplicationInput): RecipientApplicationResult {
  const errors: string[] = []

  const nameError = validateName(input.name)
  if (nameError) errors.push(nameError)

  const emailError = validateEmail(input.email)
  if (emailError) errors.push(emailError)

  const reasonError = validateRequiredText(input.reason, 'Reason', 1200)
  if (reasonError) errors.push(reasonError)

  const consentError = validateConsent(input.consentAccepted)
  if (consentError) errors.push(consentError)

  if (errors.length > 0) {
    return { status: 'validation_failed', errors }
  }

  return {
    status: 'pending_review',
    reference: generateReference('PIF'),
  }
}