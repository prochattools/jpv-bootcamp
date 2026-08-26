import assert from 'node:assert/strict'

import {
  assertStagingEmailGuardVerificationBoundary,
  STAGING_EMAIL_GUARD_FIXTURE_RECIPIENT,
  STAGING_EMAIL_GUARD_VERIFY_FLAG,
} from './payload/staging-email-guard-verification'

const validEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  DEPLOYMENT_ENV: 'staging',
  DATABASE_URL: 'postgresql://user:password@db.internal/jpvbootcamp?schema=jpvbootcamp_staging',
  STAGING_TEST_RECIPIENT_EMAIL: 'allowed@example.test',
  [STAGING_EMAIL_GUARD_VERIFY_FLAG]: '1',
}

assert.doesNotThrow(() => assertStagingEmailGuardVerificationBoundary({ ...validEnv }))

assert.throws(
  () => assertStagingEmailGuardVerificationBoundary({ ...validEnv, DEPLOYMENT_ENV: 'production' }),
  /DEPLOYMENT_ENV must be exactly staging/,
)
assert.throws(
  () => assertStagingEmailGuardVerificationBoundary({ ...validEnv, [STAGING_EMAIL_GUARD_VERIFY_FLAG]: undefined }),
  /PAYLOAD_STAGING_EMAIL_GUARD_VERIFY=1 is required/,
)
assert.throws(
  () => assertStagingEmailGuardVerificationBoundary({ ...validEnv, DATABASE_URL: 'postgresql://user:password@db.internal/production?schema=public' }),
  /schema must be exactly jpvbootcamp_staging/,
)
assert.throws(
  () => assertStagingEmailGuardVerificationBoundary({ ...validEnv, DATABASE_URL: 'postgresql://user:password@db.internal/other?schema=jpvbootcamp_staging' }),
  /database must be exactly jpvbootcamp/,
)
assert.throws(
  () => assertStagingEmailGuardVerificationBoundary({ ...validEnv, STAGING_TEST_RECIPIENT_EMAIL: STAGING_EMAIL_GUARD_FIXTURE_RECIPIENT }),
  /fixture recipient must remain blocked/,
)

assert.equal(STAGING_EMAIL_GUARD_FIXTURE_RECIPIENT, 'blocked@example.test')
console.log('payload staging email guard verification boundary tests passed')
