import assert from 'node:assert/strict'

import {
  assertProductionSchema,
  assertStagingSchema,
  REQUIRED_PRODUCTION_DATABASE,
  REQUIRED_STAGING_DATABASE,
  resolveDatabaseConnectionConfig,
} from './databaseConnectionConfig'

const production = resolveDatabaseConnectionConfig(
  'postgresql://user:password@db.internal:5433/jpvbootcamp?schema=jpvbootcamp',
  undefined,
)
const staging = resolveDatabaseConnectionConfig(
  `postgresql://user:password@db.internal:5433/${REQUIRED_STAGING_DATABASE}?schema=jpvbootcamp`,
  undefined,
)
const obsoleteSchema = resolveDatabaseConnectionConfig(
  `postgresql://user:password@db.internal:5433/${REQUIRED_STAGING_DATABASE}?schema=jpvbootcamp_staging`,
  undefined,
)
const wrongStagingDatabase = resolveDatabaseConnectionConfig(
  `postgresql://user:password@db.internal:5433/${REQUIRED_PRODUCTION_DATABASE}?schema=jpvbootcamp`,
  undefined,
)

assert.doesNotThrow(() => assertProductionSchema(production))
assert.throws(() => assertProductionSchema(staging), /Database .* Production requires 'jpvbootcamp'/)
assert.doesNotThrow(() => assertStagingSchema(staging))
assert.throws(() => assertProductionSchema(obsoleteSchema), /Production requires 'jpvbootcamp'/)
assert.throws(() => assertStagingSchema(obsoleteSchema), /Only 'jpvbootcamp' is allowed/)
assert.throws(() => assertStagingSchema(wrongStagingDatabase), /Database .* Staging requires 'jpvbootcamp_staging'/)

console.log('database connection production/staging boundary tests passed')
