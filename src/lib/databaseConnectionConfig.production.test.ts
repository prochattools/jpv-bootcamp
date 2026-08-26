import assert from 'node:assert/strict'

import {
  assertProductionSchema,
  assertStagingSchema,
  resolveDatabaseConnectionConfig,
} from './databaseConnectionConfig'

const production = resolveDatabaseConnectionConfig(
  'postgresql://user:password@db.internal:5433/jpvbootcamp?schema=jpvbootcamp',
  undefined,
)
const staging = resolveDatabaseConnectionConfig(
  'postgresql://user:password@db.internal:5433/jpvbootcamp?schema=jpvbootcamp_staging',
  undefined,
)

assert.doesNotThrow(() => assertProductionSchema(production))
assert.throws(() => assertProductionSchema(staging), /Production requires 'jpvbootcamp'/)
assert.doesNotThrow(() => assertStagingSchema(staging))
assert.throws(() => assertStagingSchema(production), /Only 'jpvbootcamp_staging' is allowed/)

console.log('database connection production/staging boundary tests passed')
