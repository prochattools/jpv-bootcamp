import assert from 'node:assert/strict'

import {
  parseStagingDatabaseUrl,
  resolveMode,
} from './payload/staging-migration-boundary'

function expectError(fn: () => unknown, pattern: RegExp) {
  assert.throws(fn, pattern)
}

const accepted = parseStagingDatabaseUrl(
  'postgresql://staging_user:super-secret@db.staging.internal:5432/jpvbootcamp_staging?schema=jpvbootcamp_staging',
)

assert.deepEqual(accepted, {
  hostname: 'db.staging.internal',
  database: 'jpvbootcamp_staging',
  schema: 'jpvbootcamp_staging',
})

const sanitized = JSON.stringify(accepted)
assert.equal(sanitized.includes('staging_user'), false)
assert.equal(sanitized.includes('super-secret'), false)
assert.equal(sanitized.includes('postgresql://'), false)

expectError(
  () => parseStagingDatabaseUrl('postgresql://user:pass@db:5432/app?schema=jpvbootcamp'),
  /schema must be exactly jpvbootcamp_staging/,
)
expectError(
  () => parseStagingDatabaseUrl('postgresql://user:pass@db:5432/app?schema=public'),
  /schema must be exactly jpvbootcamp_staging/,
)
expectError(
  () => parseStagingDatabaseUrl('postgresql://user:pass@db:5432/app'),
  /schema must be exactly jpvbootcamp_staging/,
)
expectError(() => parseStagingDatabaseUrl(undefined), /DATABASE_URL is required/)
expectError(() => parseStagingDatabaseUrl('not a URL'), /DATABASE_URL is malformed/)
expectError(
  () => parseStagingDatabaseUrl('postgresql://user:pass@db:5432/?schema=jpvbootcamp_staging'),
  /database name is missing/,
)
expectError(
  () => parseStagingDatabaseUrl('postgresql://user:pass@db:5432/other_db?schema=jpvbootcamp_staging'),
  /database must be exactly jpvbootcamp_staging/,
)

assert.equal(resolveMode(['--status']), 'status')
assert.equal(resolveMode(['--apply']), 'apply')
expectError(() => resolveMode([]), /Choose exactly one mode/)
expectError(() => resolveMode(['--status', '--apply']), /Choose exactly one mode/)

console.log('payload staging migration boundary tests passed')
