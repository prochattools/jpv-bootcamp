/**
 * Central fail-closed staging communication and member allowlist.
 *
 * This module is the single enforcement point for all outbound
 * provider calls and account/invitation mutations. Every code path
 * that sends email, invokes a provider, or mutates a member account
 * MUST call assertAllowlistedRecipient() before proceeding.
 *
 * The allowlist is fixed to exactly one identity: info@prochat.tools.
 * It cannot be extended without code change + test update.
 */

// ─── Allowlist (immutable) ──────────────────────────────────────────────────

const ALLOWED_STAGING_RECIPIENTS = Object.freeze(['info@prochat.tools'] as const)

const MAX_BATCH_SIZE = 1

// ─── Normalisation ──────────────────────────────────────────────────────────

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase()
}

// ─── Core assertion ─────────────────────────────────────────────────────────

export class StagingAllowlistViolation extends Error {
  constructor(
    public readonly reason: string,
    public readonly offendingEmails: string[],
  ) {
    super(`STAGING_ALLOWLIST_VIOLATION: ${reason}`)
    this.name = 'StagingAllowlistViolation'
  }
}

/**
 * Assert that a single recipient is the one allowed staging identity.
 * Throws StagingAllowlistViolation on any mismatch.
 */
export function assertAllowlistedRecipient(email: string): void {
  const normalised = normaliseEmail(email)
  if (!ALLOWED_STAGING_RECIPIENTS.includes(normalised as typeof ALLOWED_STAGING_RECIPIENTS[number])) {
    throw new StagingAllowlistViolation(
      `recipient '${normalised}' is not in the staging allowlist [${ALLOWED_STAGING_RECIPIENTS.join(', ')}]`,
      [normalised],
    )
  }
}

/**
 * Assert that a batch of recipients contains ONLY the allowed identity,
 * has exactly one entry (batch size 1), and no duplicates or mixed addresses.
 */
export function assertAllowlistedBatch(emails: string[]): void {
  if (emails.length === 0) {
    throw new StagingAllowlistViolation(
      'empty batch — at least one recipient required',
      [],
    )
  }

  if (emails.length > MAX_BATCH_SIZE) {
    throw new StagingAllowlistViolation(
      `batch size ${emails.length} exceeds maximum ${MAX_BATCH_SIZE} — cohort iteration is prohibited`,
      emails.map(normaliseEmail),
    )
  }

  const normalised = emails.map(normaliseEmail)
  const unique = [...new Set(normalised)]

  if (unique.length !== normalised.length) {
    throw new StagingAllowlistViolation(
      'duplicate emails in batch',
      normalised,
    )
  }

  for (const email of normalised) {
    if (!ALLOWED_STAGING_RECIPIENTS.includes(email as typeof ALLOWED_STAGING_RECIPIENTS[number])) {
      throw new StagingAllowlistViolation(
        `recipient '${email}' is not in the staging allowlist [${ALLOWED_STAGING_RECIPIENTS.join(', ')}]`,
        [email],
      )
    }
  }
}

/**
 * Guard for FluentCRM / CRM import apply mode.
 * Only permits apply when ALL contacts in the input are the allowed identity.
 * validate/dry-run/rollback modes pass through (no restriction on redacted counts).
 */
export function assertCrmApplyAllowlisted(
  mode: string,
  emails: string[],
): void {
  if (mode === 'validate' || mode === 'dry-run' || mode === 'rollback') {
    return
  }

  if (mode !== 'apply') {
    throw new StagingAllowlistViolation(
      `unknown mode '${mode}' — refusing`,
      [],
    )
  }

  if (emails.length === 0) {
    throw new StagingAllowlistViolation(
      'apply with empty contact list — refusing',
      [],
    )
  }

  const normalised = emails.map(normaliseEmail)
  const disallowed = normalised.filter(
    (e) => !ALLOWED_STAGING_RECIPIENTS.includes(e as typeof ALLOWED_STAGING_RECIPIENTS[number]),
  )

  if (disallowed.length > 0) {
    throw new StagingAllowlistViolation(
      `apply mode contains ${disallowed.length} contact(s) not in allowlist — all contacts must be info@prochat.tools`,
      disallowed,
    )
  }
}

/**
 * Guard for member invitation/reset apply mode.
 * Requires --member-email flag match, exactly one row, and that row
 * matches the allowlist.
 */
export function assertInvitationApplyAllowlisted(
  memberEmailFlag: string | undefined,
  cohortEmails: string[],
): void {
  if (!memberEmailFlag) {
    throw new StagingAllowlistViolation(
      'apply mode requires explicit --member-email info@prochat.tools flag',
      [],
    )
  }

  assertAllowlistedRecipient(memberEmailFlag)

  if (cohortEmails.length === 0) {
    throw new StagingAllowlistViolation(
      'cohort is empty — no matching row for the requested email',
      [],
    )
  }

  if (cohortEmails.length > 1) {
    throw new StagingAllowlistViolation(
      `cohort contains ${cohortEmails.length} rows — only 1 matching row is permitted`,
      cohortEmails.map(normaliseEmail),
    )
  }

  const cohortEmail = normaliseEmail(cohortEmails[0])
  const flagEmail = normaliseEmail(memberEmailFlag)

  if (cohortEmail !== flagEmail) {
    throw new StagingAllowlistViolation(
      `cohort email '${cohortEmail}' does not match --member-email '${flagEmail}'`,
      [cohortEmail],
    )
  }
}

// ─── Forbidden app ID guard ─────────────────────────────────────────────────

const FORBIDDEN_PRODUCTION_APP_ID = 'web-public-jpv-bootcamp-l66egq'
const ALLOWED_STAGING_APP_ID = 'clients-jpv-bootcamp-app-tp9xrk'

export function assertNotProductionApp(appId: string): void {
  if (appId === FORBIDDEN_PRODUCTION_APP_ID) {
    throw new StagingAllowlistViolation(
      `FORBIDDEN: attempted to target production app '${FORBIDDEN_PRODUCTION_APP_ID}'`,
      [],
    )
  }
}

export function assertStagingAppOnly(appId: string): void {
  assertNotProductionApp(appId)
  if (appId !== ALLOWED_STAGING_APP_ID) {
    throw new StagingAllowlistViolation(
      `app ID '${appId}' is not the allowed staging app '${ALLOWED_STAGING_APP_ID}'`,
      [],
    )
  }
}

// ─── Staging origin guard ───────────────────────────────────────────────────

const ALLOWED_STAGING_ORIGINS = Object.freeze([
  'https://preview.jpvbootcamp.com',
] as const)

export function assertStagingOrigin(url: string): void {
  const origin = new URL(url).origin
  if (!ALLOWED_STAGING_ORIGINS.includes(origin as typeof ALLOWED_STAGING_ORIGINS[number])) {
    throw new StagingAllowlistViolation(
      `origin '${origin}' is not an allowed staging origin [${ALLOWED_STAGING_ORIGINS.join(', ')}]`,
      [],
    )
  }
}
