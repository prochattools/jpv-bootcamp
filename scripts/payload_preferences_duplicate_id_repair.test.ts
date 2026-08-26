import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  buildPayloadPreferencesDuplicateIdRepairApplySql,
  buildPayloadPreferencesDuplicateIdRepairDryRunSql,
  getPayloadPreferencesDuplicateIdRepairSchema,
} from '../src/lib/payloadPreferencesDuplicateIdRepairSql'

const stagingUrl =
  'postgresql://user:password@db.internal:5432/app?schema=jpvbootcamp_staging'

assert.equal(getPayloadPreferencesDuplicateIdRepairSchema(stagingUrl), 'jpvbootcamp_staging')
assert.throws(
  () => getPayloadPreferencesDuplicateIdRepairSchema('postgresql://user:password@db.internal:5432/app?schema=jpvbootcamp'),
  /schema must be exactly jpvbootcamp_staging/,
)
assert.throws(
  () => getPayloadPreferencesDuplicateIdRepairSchema('postgresql://user:password@db.internal:5432/app?schema=public'),
  /schema must be exactly jpvbootcamp_staging/,
)
assert.throws(() => getPayloadPreferencesDuplicateIdRepairSchema(undefined), /DATABASE_URL is required/)
assert.throws(() => getPayloadPreferencesDuplicateIdRepairSchema('not a url'), /DATABASE_URL is malformed/)

const dryRunSql = buildPayloadPreferencesDuplicateIdRepairDryRunSql(stagingUrl)
const applySql = buildPayloadPreferencesDuplicateIdRepairApplySql(stagingUrl)
const scriptSource = readFileSync('scripts/payload/repair-staging-preferences-ids.mts', 'utf8')

assert.match(dryRunSql, /payload_preferences/)
assert.match(dryRunSql, /safe_status/)
assert.match(dryRunSql, /planned_reassignment_count/)
assert.equal(/\bDELETE\b/i.test(dryRunSql), false)
assert.equal(/\bTRUNCATE\b/i.test(dryRunSql), false)
assert.equal(/\bDROP TABLE\b/i.test(dryRunSql), false)
assert.equal(/\bemail\b/i.test(dryRunSql), false)
assert.equal(/\btoken\b/i.test(dryRunSql), false)
assert.equal(/\bprovider\b/i.test(dryRunSql), false)
assert.equal(dryRunSql.includes('@'), false)

assert.match(applySql, /UPDATE/)
assert.match(applySql, /setval/)
assert.match(applySql, /row_count_before/)
assert.match(applySql, /row_count_after/)
assert.equal(/\bDELETE\b/i.test(applySql), false)
assert.equal(/\bTRUNCATE\b/i.test(applySql), false)
assert.equal(/\bDROP TABLE\b/i.test(applySql), false)
assert.equal(applySql.includes('payload_preferences'), true)
assert.equal(applySql.includes('payload_preferences_rels'), false)
assert.equal(applySql.includes('created_at'), true)
assert.equal(applySql.includes('updated_at'), false)

assert.match(scriptSource, /apply-staging-preferences-id-repair/)
assert.match(scriptSource, /dry-run/)
assert.match(scriptSource, /schema=/)
assert.doesNotMatch(scriptSource, /DROP TABLE|TRUNCATE|DELETE/i)

console.log('payload preferences duplicate id repair tests passed')
