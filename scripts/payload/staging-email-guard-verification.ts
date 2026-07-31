import { parseStagingDatabaseUrl } from './staging-migration-boundary'

export const STAGING_EMAIL_GUARD_VERIFY_FLAG = 'PAYLOAD_STAGING_EMAIL_GUARD_VERIFY'
export const STAGING_EMAIL_GUARD_FIXTURE_RECIPIENT = 'blocked@example.test'

export function assertStagingEmailGuardVerificationBoundary(env: NodeJS.ProcessEnv): void {
  if ((env.DEPLOYMENT_ENV ?? '').trim().toLowerCase() !== 'staging') {
    throw new Error('Refusing email-guard verification: DEPLOYMENT_ENV must be exactly staging')
  }

  if ((env[STAGING_EMAIL_GUARD_VERIFY_FLAG] ?? '').trim() !== '1') {
    throw new Error(`Refusing email-guard verification: ${STAGING_EMAIL_GUARD_VERIFY_FLAG}=1 is required`)
  }

  parseStagingDatabaseUrl(env.DATABASE_URL)

  const allowed = (env.STAGING_TEST_RECIPIENT_EMAIL ?? '').trim().toLowerCase()
  if (!allowed) {
    throw new Error('Refusing email-guard verification: STAGING_TEST_RECIPIENT_EMAIL is required')
  }
  if (allowed === STAGING_EMAIL_GUARD_FIXTURE_RECIPIENT) {
    throw new Error('Refusing email-guard verification: fixture recipient must remain blocked')
  }
}
