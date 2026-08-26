import assert from 'node:assert/strict'

import {
  buildPayloadPreferencesConstraintDownSql,
  buildPayloadPreferencesConstraintUpSql,
  getPayloadPreferencesConstraintSchema,
} from '../src/lib/payloadPreferencesConstraintMigrationSql'

const stagingUrl =
  'postgresql://user:password@db.internal:5432/app?schema=jpvbootcamp_staging'
const stagingSql = buildPayloadPreferencesConstraintUpSql(stagingUrl)
const downSql = buildPayloadPreferencesConstraintDownSql(stagingUrl)

assert.equal(getPayloadPreferencesConstraintSchema(stagingUrl), 'jpvbootcamp_staging')
assert.equal(
  getPayloadPreferencesConstraintSchema(
    'postgresql://user:password@db.internal:5432/app?schema=another_valid_schema',
  ),
  'another_valid_schema',
)

assert.throws(
  () => getPayloadPreferencesConstraintSchema('postgresql://user:password@db.internal:5432/app'),
  /explicit schema parameter/,
)
assert.throws(() => getPayloadPreferencesConstraintSchema('not a URL'), /Malformed DATABASE_URL/)
assert.throws(
  () =>
    getPayloadPreferencesConstraintSchema(
      'postgresql://user:password@db.internal:5432/app?schema=invalid-schema',
    ),
  /Invalid Payload migration schema/,
)

assert.match(stagingSql, /jpvbootcamp_staging\.payload_preferences/)
assert.match(stagingSql, /null id values/)
assert.match(stagingSql, /duplicate id values/)
assert.match(stagingSql, /contype IN \('p', 'u'\)/)
assert.match(stagingSql, /IF NOT has_suitable_constraint THEN/)
assert.match(stagingSql, /payload_preferences_id_unique/)
assert.match(stagingSql, /pg_get_serial_sequence/)
assert.match(stagingSql, /setval/)

assert.equal(/\bDELETE\b/i.test(stagingSql), false)
assert.equal(/\bTRUNCATE\b/i.test(stagingSql), false)
assert.equal(/\bUPDATE\b/i.test(stagingSql), false)
assert.equal(stagingSql.includes('"jpvbootcamp".'), false)

assert.match(downSql, /DROP CONSTRAINT IF EXISTS "payload_preferences_id_unique"/)
assert.equal(downSql.includes('DROP CONSTRAINT IF EXISTS "payload_preferences_pkey"'), false)

console.log('payload preferences constraint migration tests passed')
