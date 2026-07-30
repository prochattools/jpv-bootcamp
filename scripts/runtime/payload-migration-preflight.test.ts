import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const preflight = require('./payload-migration-preflight.cjs') as {
  REQUIRED_PAYLOAD_MIGRATIONS: string[]
  missingMigrationNames(rows: Array<{ name: string }>): string[]
  resolveSchema(environment: Record<string, string | undefined>): string
  verifyPayloadMigrationState(options: {
    environment: Record<string, string | undefined>
    clientFactory: () => { connect(): Promise<void>; query(sql: string): Promise<{ rows: Array<{ name: string }> }>; end(): Promise<void> }
  }): Promise<string[]>
}

const migrationIndex = readFileSync('src/migrations/index.ts', 'utf8')
const registeredNames = [...migrationIndex.matchAll(/name: '([^']+)'/g)].map((match) => match[1])
assert.deepEqual(preflight.REQUIRED_PAYLOAD_MIGRATIONS, registeredNames)
assert.equal(preflight.resolveSchema({ DATABASE_URL: 'postgresql://user:password@db/app?schema=jpvbootcamp_staging' }), 'jpvbootcamp_staging')
assert.equal(preflight.resolveSchema({ DATABASE_URL: 'postgresql://user:password@db/app' }), 'jpvbootcamp')
assert.equal(preflight.resolveSchema({ DATABASE_URL: 'postgresql://user:password@db/app?schema=ignored', PAYLOAD_MIGRATION_SCHEMA: 'reviewed_schema' }), 'reviewed_schema')
assert.throws(() => preflight.resolveSchema({ DATABASE_URL: 'not-a-url' }), /database_url_unavailable/)
assert.throws(() => preflight.resolveSchema({ DATABASE_URL: 'postgresql://user:password@db/app?schema=invalid-schema' }), /invalid_schema/)

const lastMigration = preflight.REQUIRED_PAYLOAD_MIGRATIONS.at(-1)
assert(lastMigration)
assert.deepEqual(preflight.missingMigrationNames([{ name: preflight.REQUIRED_PAYLOAD_MIGRATIONS[0] }]), preflight.REQUIRED_PAYLOAD_MIGRATIONS.slice(1))

async function main(): Promise<void> {
  const queries: string[] = []
  const missing = await preflight.verifyPayloadMigrationState({
    environment: { DATABASE_URL: 'postgresql://user:password@db/app?schema=jpvbootcamp_staging' },
    clientFactory: () => ({
      async connect() {},
      async query(sql: string) {
        queries.push(sql)
        return { rows: preflight.REQUIRED_PAYLOAD_MIGRATIONS.filter((name) => name !== lastMigration).map((name) => ({ name })) }
      },
      async end() {},
    }),
  })
  assert.deepEqual(missing, [lastMigration])
  assert.deepEqual(queries, ['SELECT "name" FROM "jpvbootcamp_staging"."payload_migrations" WHERE "batch" <> -1'])
  console.log('payload-migration-preflight.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
