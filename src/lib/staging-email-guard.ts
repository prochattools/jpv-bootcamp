const STAGING_ENVS = ['preview', 'staging'] as const

function isStagingEnv(): boolean {
  const env = (process.env.DEPLOYMENT_ENV ?? '').trim().toLowerCase()
  return (STAGING_ENVS as readonly string[]).includes(env)
}

const SINGLE_EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/

function loadAllowedRecipient(): string {
  const raw = process.env.STAGING_TEST_RECIPIENT_EMAIL
  if (!raw || !raw.trim()) {
    throw new Error(
      'STAGING_EMAIL_GUARD: STAGING_TEST_RECIPIENT_EMAIL is required but not set.'
    )
  }
  const normalised = raw.trim().toLowerCase()
  if (!SINGLE_EMAIL_RE.test(normalised)) {
    throw new Error(
      'STAGING_EMAIL_GUARD: STAGING_TEST_RECIPIENT_EMAIL is not a valid single email.'
    )
  }
  return normalised
}

export class StagingEmailGuardViolation extends Error {
  constructor(
    public readonly blockedRecipients: string[],
    public readonly caller: string,
  ) {
    super(
      `STAGING_EMAIL_GUARD: blocked outbound email to [${blockedRecipients.join(', ')}] ` +
      `from ${caller}. Only STAGING_TEST_RECIPIENT_EMAIL is permitted in staging/preview.`
    )
    this.name = 'StagingEmailGuardViolation'
  }
}

export function assertStagingRecipientAllowed(
  recipients: string[],
  caller: string,
): void {
  if (!isStagingEnv()) return

  const allowed = loadAllowedRecipient()
  const blocked = recipients
    .map((r) => r.trim().toLowerCase())
    .filter((r) => r !== allowed)

  if (blocked.length > 0) {
    throw new StagingEmailGuardViolation(blocked, caller)
  }
}
