import assert from 'node:assert/strict'

import {
  resolveDatabaseConnectionConfig,
  validateDatabaseSchemaIdentifier,
} from '../../src/lib/databaseConnectionConfig'
import { PAYLOAD_MIGRATION_NAMES } from '../../src/migrations/migrationRegistry'
import {
  REGISTERED_PAYLOAD_MIGRATIONS,
  REGISTERED_PRISMA_MIGRATIONS,
  buildStagingMigrationStatus,
  classifyPrismaMigration,
  createStagingReadOnlyAdapter,
  parseCliArgs,
  runMigrationStatusCli,
  type MigrationEvidenceAdapter,
  type PgClientFactory,
  type PgClientLike,
  type PrismaMigrationRow,
} from './buildStagingMigrationStatus'

let passed = 0
let failed = 0

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn()
    passed += 1
    console.log(`PASS ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL ${name}`)
    console.error(error)
  }
}

function appliedPrisma(name = REGISTERED_PRISMA_MIGRATIONS[0]): PrismaMigrationRow {
  return {
    migration_name: name,
    started_at: '2026-08-01T00:00:00.000Z',
    finished_at: '2026-08-01T00:00:01.000Z',
    rolled_back_at: null,
    applied_steps_count: 1,
    has_logs: false,
  }
}

class RecordingClient implements PgClientLike {
  readonly queries: string[] = []
  connectCalls = 0
  endCalls = 0
  connected = false
  ended = false
  schema = 'jpv_staging'
  failOn: string | null = null
  failMessage = 'synthetic database secret=do-not-print'
  failConnect = false
  failEnd = false

  async connect(): Promise<void> {
    this.connectCalls += 1
    if (this.failConnect) throw new Error('synthetic connect credential=do-not-print')
    this.connected = true
  }

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(text: string): Promise<{ rows: Row[] }> {
    this.queries.push(text)
    if (this.failOn && text.includes(this.failOn)) throw new Error(this.failMessage)
    if (text === 'SELECT current_schema() AS current_schema') {
      return { rows: [{ current_schema: this.schema }] as unknown as Row[] }
    }
    if (text.includes('.payload_migrations')) {
      return {
        rows: PAYLOAD_MIGRATION_NAMES.map((name) => ({ name, batch: 1 })) as unknown as Row[],
      }
    }
    if (text.includes('._prisma_migrations')) {
      return { rows: REGISTERED_PRISMA_MIGRATIONS.map((name) => appliedPrisma(name)) as unknown as Row[] }
    }
    return { rows: [] }
  }

  async end(): Promise<void> {
    this.endCalls += 1
    if (this.failEnd) throw new Error('synthetic close credential=do-not-print')
    this.ended = true
  }
}

async function run(): Promise<void> {
  await test('canonical registry is the migration-status registry', () => {
    assert.deepEqual([...REGISTERED_PAYLOAD_MIGRATIONS], [...PAYLOAD_MIGRATION_NAMES])
    assert.ok(REGISTERED_PRISMA_MIGRATIONS.length > 0)
    assert.equal(new Set(REGISTERED_PRISMA_MIGRATIONS).size, REGISTERED_PRISMA_MIGRATIONS.length)
  })

  await test('operator evidence is required without an adapter', async () => {
    const report = await buildStagingMigrationStatus(null, 'jpv_staging')
    assert.equal(report.result, 'OPERATOR_EVIDENCE_REQUIRED')
    assert.equal(report.missingPayloadMigrations.length, PAYLOAD_MIGRATION_NAMES.length)
  })

  await test('invalid expected schema is rejected before adapter invocation', async () => {
    let invoked = false
    const adapter: MigrationEvidenceAdapter = {
      async collectMigrationEvidence() {
        invoked = true
        throw new Error('should not run')
      },
    }
    await assert.rejects(() => buildStagingMigrationStatus(adapter, 'unsafe-schema;drop'))
    assert.equal(invoked, false)
  })

  await test('verified report requires all registered Payload and applied Prisma migrations', async () => {
    const adapter: MigrationEvidenceAdapter = {
      async collectMigrationEvidence() {
        return {
          schemaIdentity: 'jpv_staging',
          payloadMigrations: PAYLOAD_MIGRATION_NAMES.map((name) => ({ name, batch: 1 })),
          prismaMigrations: REGISTERED_PRISMA_MIGRATIONS.map((name) => appliedPrisma(name)),
        }
      },
    }
    const report = await buildStagingMigrationStatus(adapter, 'jpv_staging')
    assert.equal(report.result, 'VERIFIED')
    assert.equal(report.blockers.length, 0)
  })

  await test('negative Payload batch is not treated as applied', async () => {
    const adapter: MigrationEvidenceAdapter = {
      async collectMigrationEvidence() {
        return {
          schemaIdentity: 'jpv_staging',
          payloadMigrations: PAYLOAD_MIGRATION_NAMES.map((name, index) => ({ name, batch: index === 0 ? -1 : 1 })),
          prismaMigrations: [],
        }
      },
    }
    const report = await buildStagingMigrationStatus(adapter, 'jpv_staging')
    assert.equal(report.result, 'MISMATCH')
    assert.deepEqual(report.missingPayloadMigrations, [PAYLOAD_MIGRATION_NAMES[0]])
  })

  await test('empty Prisma evidence cannot produce a verified report', async () => {
    const adapter: MigrationEvidenceAdapter = {
      async collectMigrationEvidence() {
        return {
          schemaIdentity: 'jpv_staging',
          payloadMigrations: PAYLOAD_MIGRATION_NAMES.map((name) => ({ name, batch: 1 })),
          prismaMigrations: [],
        }
      },
    }
    const report = await buildStagingMigrationStatus(adapter, 'jpv_staging')
    assert.equal(report.result, 'MISMATCH')
    assert.ok(report.blockers.includes('Prisma migration evidence is empty'))
    assert.deepEqual(report.missingPrismaMigrations, REGISTERED_PRISMA_MIGRATIONS)
  })

  await test('an arbitrary applied Prisma row cannot substitute for the registered inventory', async () => {
    const adapter: MigrationEvidenceAdapter = {
      async collectMigrationEvidence() {
        return {
          schemaIdentity: 'jpv_staging',
          payloadMigrations: PAYLOAD_MIGRATION_NAMES.map((name) => ({ name, batch: 1 })),
          prismaMigrations: [appliedPrisma('20990101_arbitrary')],
        }
      },
    }
    const report = await buildStagingMigrationStatus(adapter, 'jpv_staging')
    assert.equal(report.result, 'MISMATCH')
    assert.deepEqual(report.missingPrismaMigrations, REGISTERED_PRISMA_MIGRATIONS)
    assert.deepEqual(report.unexpectedPrismaMigrations, ['20990101_arbitrary'])
  })

  await test('Prisma state classification is fail closed', () => {
    assert.equal(classifyPrismaMigration(appliedPrisma()), 'applied')
    assert.equal(classifyPrismaMigration({ ...appliedPrisma(), has_logs: true }), 'failed')
    assert.equal(classifyPrismaMigration({ ...appliedPrisma(), finished_at: null }), 'in-progress')
    assert.equal(classifyPrismaMigration({ ...appliedPrisma(), rolled_back_at: '2026-08-02T00:00:00Z' }), 'rolled-back')
    assert.equal(classifyPrismaMigration({ ...appliedPrisma(), started_at: null }), 'unexpected')
  })

  await test('database helper strips schema and preserves redacted metadata only', () => {
    const config = resolveDatabaseConnectionConfig(
      'postgres://user:secret@localhost/example?sslmode=require&schema=jpv_staging',
      undefined,
    )
    assert.equal(config.schema, 'jpv_staging')
    assert.equal(config.connectionString.includes('schema='), false)
    assert.equal(config.connectionString.includes('sslmode=require'), true)
    assert.equal(config.metadata.credentialsPresent, true)
    assert.equal(JSON.stringify(config.metadata).includes('secret'), false)
  })

  await test('database helper supports override and safe default', () => {
    assert.equal(resolveDatabaseConnectionConfig(undefined, undefined).schema, 'jpvbootcamp')
    assert.equal(resolveDatabaseConnectionConfig('postgres://localhost/db?schema=first', 'second').schema, 'second')
    assert.throws(() => validateDatabaseSchemaIdentifier('bad-schema'))
  })

  await test('database helper preserves malformed Payload URL behavior without leaking it into metadata', () => {
    const malformed = 'not a valid database URL with user:synthetic-secret'
    const config = resolveDatabaseConnectionConfig(malformed, 'safe_schema')
    assert.equal(config.connectionString, malformed)
    assert.equal(config.schema, 'safe_schema')
    assert.equal(config.metadata.protocol, null)
    assert.equal(config.metadata.credentialsPresent, false)
    assert.equal(JSON.stringify(config.metadata).includes('synthetic-secret'), false)
    assert.equal(Object.hasOwn(config.metadata, 'username'), false)
    assert.equal(Object.hasOwn(config.metadata, 'password'), false)
  })

  await test('CLI parser supports equals and space forms with acknowledgement', () => {
    assert.deepEqual(parseCliArgs([
      '--mode=staging-read-only',
      '--expected-schema=jpv_staging',
      '--acknowledge-read-only',
    ]), {
      help: false,
      mode: 'staging-read-only',
      expectedSchema: 'jpv_staging',
      acknowledgeReadOnly: true,
    })
    assert.equal(parseCliArgs([
      '--mode', 'staging-read-only',
      '--expected-schema', 'jpv_staging',
      '--acknowledge-read-only',
    ]).expectedSchema, 'jpv_staging')
  })

  await test('CLI parser rejects duplicates, unknown flags, positional args, and unsafe schema', () => {
    assert.throws(() => parseCliArgs(['--mode=x', '--mode=y']))
    assert.throws(() => parseCliArgs(['--unknown']))
    assert.throws(() => parseCliArgs(['positional']))
    assert.throws(() => parseCliArgs(['--expected-schema=unsafe-name']))
    assert.throws(() => parseCliArgs(['--mode']))
    assert.throws(() => parseCliArgs(['--mode=']))
    assert.throws(() => parseCliArgs(['--expected-schema', '--acknowledge-read-only']))
  })

  await test('CLI guard validation finishes before any client construction', async () => {
    let constructed = 0
    const exitCode = await runMigrationStatusCli([
      '--mode=unsupported',
      '--expected-schema=jpv_staging',
      '--acknowledge-read-only',
    ], {
      DATABASE_URL: 'postgres://localhost/db?schema=jpv_staging',
    }, () => undefined, {
      clientFactory: () => {
        constructed += 1
        return new RecordingClient()
      },
    })
    assert.equal(exitCode, 1)
    assert.equal(constructed, 0)
  })

  await test('CLI returns operator-evidence code without constructing a database client', async () => {
    const output: string[] = []
    let constructed = 0
    const exitCode = await runMigrationStatusCli([
      '--mode=staging-read-only',
      '--expected-schema=jpv_staging',
      '--acknowledge-read-only',
    ], {}, (value) => output.push(value), {
      clientFactory: () => {
        constructed += 1
        return new RecordingClient()
      },
    })
    assert.equal(exitCode, 3)
    assert.equal(constructed, 0)
    assert.match(output.join('\n'), /OPERATOR_EVIDENCE_REQUIRED/)
    assert.equal(output.join('\n').includes('connectionString'), false)
  })

  await test('adapter uses one client, one read-only transaction, verified schema, and reviewed queries', async () => {
    const client = new RecordingClient()
    const factoryCalls: Array<{ connectionString: string; connectionTimeoutMillis: number }> = []
    const clientFactory: PgClientFactory = (config) => {
      factoryCalls.push(config)
      return client
    }
    const adapter = createStagingReadOnlyAdapter({
      databaseUrl: 'postgres://user:secret@localhost/db?schema=jpv_staging',
      expectedSchema: 'jpv_staging',
      clientFactory,
    })
    const report = await buildStagingMigrationStatus(adapter, 'jpv_staging')
    assert.equal(report.result, 'VERIFIED')
    assert.equal(factoryCalls.length, 1)
    assert.equal(factoryCalls[0].connectionString.includes('schema='), false)
    assert.equal(client.connectCalls, 1)
    assert.equal(client.connected, true)
    assert.equal(client.endCalls, 1)
    assert.equal(client.ended, true)
    assert.equal(client.queries.filter((query) => query === 'BEGIN TRANSACTION READ ONLY').length, 1)
    assert.equal(client.queries.filter((query) => query === "SET LOCAL statement_timeout = '5000ms'").length, 1)
    assert.equal(client.queries.filter((query) => query === 'SET LOCAL search_path TO "jpv_staging"').length, 1)
    assert.equal(client.queries.at(-1), 'ROLLBACK')
    const schemaIndex = client.queries.indexOf('SELECT current_schema() AS current_schema')
    const payloadIndex = client.queries.findIndex((query) => query.includes('.payload_migrations'))
    const prismaIndex = client.queries.findIndex((query) => query.includes('._prisma_migrations'))
    assert.ok(schemaIndex >= 0 && schemaIndex < payloadIndex && payloadIndex < prismaIndex)
    assert.match(client.queries[payloadIndex], /^SELECT name, batch FROM "jpv_staging"\.payload_migrations ORDER BY id ASC$/)
    assert.match(client.queries[prismaIndex], /\(logs IS NOT NULL\) AS has_logs/)
    assert.equal(client.queries[prismaIndex].includes('SELECT *'), false)
    assert.equal(client.queries[prismaIndex].includes('SELECT logs'), false)
  })

  await test('schema mismatch prevents migration metadata queries and still rolls back', async () => {
    const client = new RecordingClient()
    client.schema = 'wrong_schema'
    const adapter = createStagingReadOnlyAdapter({
      databaseUrl: 'postgres://localhost/db?schema=jpv_staging',
      expectedSchema: 'jpv_staging',
      clientFactory: () => client,
    })
    await assert.rejects(() => buildStagingMigrationStatus(adapter, 'jpv_staging'), /Database-reported schema/)
    assert.equal(client.queries.some((query) => query.includes('.payload_migrations')), false)
    assert.equal(client.queries.at(-1), 'ROLLBACK')
    assert.equal(client.ended, true)
  })

  await test('query failure is secret-safe, rolls back, and closes', async () => {
    const client = new RecordingClient()
    client.failOn = '.payload_migrations'
    const adapter = createStagingReadOnlyAdapter({
      databaseUrl: 'postgres://user:secret@localhost/db?schema=jpv_staging',
      expectedSchema: 'jpv_staging',
      clientFactory: () => client,
    })
    let message = ''
    try {
      await buildStagingMigrationStatus(adapter, 'jpv_staging')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.equal(message, 'Read-only staging migration query failed')
    assert.equal(message.includes('secret'), false)
    assert.equal(client.queries.at(-1), 'ROLLBACK')
    assert.equal(client.ended, true)
  })

  await test('database errors mentioning schema are still redacted', async () => {
    const client = new RecordingClient()
    client.failOn = '.payload_migrations'
    client.failMessage = 'permission denied for schema private_schema secret=do-not-print'
    const adapter = createStagingReadOnlyAdapter({
      databaseUrl: 'postgres://localhost/db?schema=jpv_staging',
      expectedSchema: 'jpv_staging',
      clientFactory: () => client,
    })
    await assert.rejects(
      () => buildStagingMigrationStatus(adapter, 'jpv_staging'),
      /^Error: Read-only staging migration query failed$/,
    )
    assert.equal(client.queries.at(-1), 'ROLLBACK')
    assert.equal(client.ended, true)
  })

  await test('configured schema mismatch fails before client construction', () => {
    let constructed = false
    assert.throws(() => createStagingReadOnlyAdapter({
      databaseUrl: 'postgres://localhost/db?schema=other_schema',
      expectedSchema: 'jpv_staging',
      clientFactory: () => {
        constructed = true
        return new RecordingClient()
      },
    }))
    assert.equal(constructed, false)
  })

  await test('non-PostgreSQL, malformed, and unsafe timeout configuration fail before client construction', () => {
    let constructed = 0
    const clientFactory = () => {
      constructed += 1
      return new RecordingClient()
    }
    assert.throws(() => createStagingReadOnlyAdapter({
      databaseUrl: 'mysql://localhost/db?schema=jpv_staging',
      expectedSchema: 'jpv_staging',
      clientFactory,
    }), /must use PostgreSQL/)
    assert.throws(() => createStagingReadOnlyAdapter({
      databaseUrl: 'not-a-url',
      expectedSchema: 'jpv_staging',
      schemaOverride: 'jpv_staging',
      clientFactory,
    }), /must use PostgreSQL/)
    assert.throws(() => createStagingReadOnlyAdapter({
      databaseUrl: 'postgres://localhost/db?schema=jpv_staging',
      expectedSchema: 'jpv_staging',
      statementTimeoutMillis: 0,
      clientFactory,
    }), /Statement timeout/)
    assert.equal(constructed, 0)
  })

  await test('connect failure is redacted and still closes the constructed client', async () => {
    const client = new RecordingClient()
    client.failConnect = true
    const adapter = createStagingReadOnlyAdapter({
      databaseUrl: 'postgres://user:secret@localhost/db?schema=jpv_staging',
      expectedSchema: 'jpv_staging',
      clientFactory: () => client,
    })
    let message = ''
    try {
      await buildStagingMigrationStatus(adapter, 'jpv_staging')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.equal(message, 'Read-only staging migration query failed')
    assert.equal(message.includes('credential'), false)
    assert.equal(client.connectCalls, 1)
    assert.equal(client.endCalls, 1)
  })

  await test('rollback failure after successful queries still closes the client', async () => {
    const client = new RecordingClient()
    client.failOn = 'ROLLBACK'
    const adapter = createStagingReadOnlyAdapter({
      databaseUrl: 'postgres://localhost/db?schema=jpv_staging',
      expectedSchema: 'jpv_staging',
      clientFactory: () => client,
    })
    await assert.rejects(
      () => buildStagingMigrationStatus(adapter, 'jpv_staging'),
      /^Error: Read-only staging migration rollback failed$/,
    )
    assert.equal(client.endCalls, 1)
    assert.equal(client.ended, true)
  })

  await test('connection close failure is generic and contains no injected secret', async () => {
    const client = new RecordingClient()
    client.failEnd = true
    const adapter = createStagingReadOnlyAdapter({
      databaseUrl: 'postgres://localhost/db?schema=jpv_staging',
      expectedSchema: 'jpv_staging',
      clientFactory: () => client,
    })
    let message = ''
    try {
      await buildStagingMigrationStatus(adapter, 'jpv_staging')
    } catch (error) {
      message = error instanceof Error ? error.message : String(error)
    }
    assert.equal(message, 'Read-only staging migration connection close failed')
    assert.equal(message.includes('credential'), false)
    assert.equal(client.endCalls, 1)
  })

  console.log(`\n${passed + failed} tests | ${passed} passed | ${failed} failed`)
  if (failed > 0) process.exitCode = 1
}

run().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
