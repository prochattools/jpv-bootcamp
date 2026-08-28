/**
 * Central fail-closed staging communication and member allowlist.
 *
 * This module is the single enforcement point for all outbound
 * provider calls and account/invitation mutations. Every code path
 * that sends email, invokes a provider, or mutates a member account
 * MUST call assertAllowlistedRecipient() before proceeding.
 *
 * The allowlist is driven by environment variables:
 *   STAGING_TEST_RECIPIENT_EMAIL — sole outbound email recipient
 *   STAGING_TEST_MEMBER_EMAIL — sole authenticated QA identity
 *   STAGING_MIGRATION_MEMBER_EMAIL — future one-record selector (documented only)
 *
 * All three must be a single valid email address. Empty, list, or missing
 * values are rejected at load time. Operators set real values in Dokploy staging.
 */

import { ENVIRONMENT_TOPOLOGY } from '../../src/lib/environmentTopology'

// ─── Email validation ───────────────────────────────────────────────────────

const SINGLE_EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

function validateSingleEmail(raw: string | undefined, varName: string): string {
  if (!raw || !raw.trim()) {
    throw new Error(
      `STAGING_SAFETY: ${varName} is required but not set. ` +
      `Set it to a single email address in the environment.`
    )
  }
  const normalised = raw.trim().toLowerCase()
  if (normalised.includes(',') || normalised.includes(';') || normalised.includes(' ')) {
    throw new Error(
      `STAGING_SAFETY: ${varName} must be a single email address, not a list. Got: [REDACTED]`
    )
  }
  if (!SINGLE_EMAIL_RE.test(normalised)) {
    throw new Error(
      `STAGING_SAFETY: ${varName} is not a valid email address. Got: [REDACTED]`
    )
  }
  return normalised
}

// ─── Environment-driven allowlist (fail-closed) ─────────────────────────────

function loadAllowedRecipient(): string {
  return validateSingleEmail(process.env.STAGING_TEST_RECIPIENT_EMAIL, 'STAGING_TEST_RECIPIENT_EMAIL')
}

function loadAllowedMember(): string {
  return validateSingleEmail(process.env.STAGING_TEST_MEMBER_EMAIL, 'STAGING_TEST_MEMBER_EMAIL')
}

export function getStagingTestRecipientEmail(): string {
  return loadAllowedRecipient()
}

export function getStagingTestMemberEmail(): string {
  return loadAllowedMember()
}

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
  const allowed = loadAllowedRecipient()
  const normalised = normaliseEmail(email)
  if (normalised !== allowed) {
    throw new StagingAllowlistViolation(
      `recipient '${normalised}' is not the staging-allowed recipient`,
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

  const allowed = loadAllowedRecipient()
  for (const email of normalised) {
    if (email !== allowed) {
      throw new StagingAllowlistViolation(
        `recipient '${email}' is not the staging-allowed recipient`,
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

  const allowed = loadAllowedRecipient()
  const normalised = emails.map(normaliseEmail)
  const disallowed = normalised.filter((e) => e !== allowed)

  if (disallowed.length > 0) {
    throw new StagingAllowlistViolation(
      `apply mode contains ${disallowed.length} contact(s) not in allowlist — all contacts must match STAGING_TEST_RECIPIENT_EMAIL`,
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
      'apply mode requires explicit --member-email flag matching STAGING_TEST_MEMBER_EMAIL',
      [],
    )
  }

  const allowedMember = loadAllowedMember()
  const flagNormalised = normaliseEmail(memberEmailFlag)
  if (flagNormalised !== allowedMember) {
    throw new StagingAllowlistViolation(
      `--member-email '${flagNormalised}' does not match STAGING_TEST_MEMBER_EMAIL`,
      [flagNormalised],
    )
  }

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

const FORBIDDEN_PRODUCTION_APP_IDS = Object.freeze([
  ENVIRONMENT_TOPOLOGY.production.dokploySlug,
  ENVIRONMENT_TOPOLOGY.production.dokployApplicationId,
  ENVIRONMENT_TOPOLOGY.legacy.dokploySlug,
  ENVIRONMENT_TOPOLOGY.legacy.dokployApplicationId,
] as const)
const ALLOWED_STAGING_APP_IDS = Object.freeze([
  ENVIRONMENT_TOPOLOGY.staging.dokploySlug,
  ENVIRONMENT_TOPOLOGY.staging.dokployApplicationId,
] as const)

export function assertNotProductionApp(appId: string): void {
  if (FORBIDDEN_PRODUCTION_APP_IDS.includes(appId as typeof FORBIDDEN_PRODUCTION_APP_IDS[number])) {
    throw new StagingAllowlistViolation(
      `FORBIDDEN: attempted to target protected production or legacy app '${appId}'`,
      [],
    )
  }
}

export function assertStagingAppOnly(appId: string): void {
  assertNotProductionApp(appId)
  if (!ALLOWED_STAGING_APP_IDS.includes(appId as typeof ALLOWED_STAGING_APP_IDS[number])) {
    throw new StagingAllowlistViolation(
      `app ID '${appId}' is not an allowed staging app [${ALLOWED_STAGING_APP_IDS.join(', ')}]`,
      [],
    )
  }
}

// ─── Staging origin guard ───────────────────────────────────────────────────

const ALLOWED_STAGING_ORIGINS = Object.freeze([
  ENVIRONMENT_TOPOLOGY.staging.origin,
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
