import assert from 'node:assert/strict'

import {
  resolveDatabaseConnectionConfig,
  validateDatabaseSchemaIdentifier,
} from '../../src/lib/databaseConnectionConfig'
import { PAYLOAD_MIGRATION_NAMES } from '../../src/lib/payloadMigrationRegistry'
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
  schema = 'jpvbootcamp_staging'
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
      // node-postgres returns numeric columns as strings to preserve precision
      return {
        rows: PAYLOAD_MIGRATION_NAMES.map((name) => ({ name, batch: '1' })) as unknown as Row[],
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
    const report = await buildStagingMigrationStatus(null, 'jpvbootcamp_staging')
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
          schemaIdentity: 'jpvbootcamp_staging',
          payloadMigrations: PAYLOAD_MIGRATION_NAMES.map((name) => ({ name, batch: 1 })),
          prismaMigrations: REGISTERED_PRISMA_MIGRATIONS.map((name) => appliedPrisma(name)),
        }
      },
    }
    const report = await buildStagingMigrationStatus(adapter, 'jpvbootcamp_staging')
    assert.equal(report.result, 'VERIFIED')
    assert.equal(report.blockers.length, 0)
  })

  await test('negative Payload batch is classified malformed and blocks', async () => {
    const adapter: MigrationEvidenceAdapter = {
      async collectMigrationEvidence() {
        return {
          schemaIdentity: 'jpvbootcamp_staging',
          payloadMigrations: PAYLOAD_MIGRATION_NAMES.map((name, index) => ({ name, batch: index === 0 ? -1 : 1 })),
          prismaMigrations: REGISTERED_PRISMA_MIGRATIONS.map((name) => appliedPrisma(name)),
        }
      },
    }
    const report = await buildStagingMigrationStatus(adapter, 'jpvbootcamp_staging')
    assert.equal(report.result, 'MISMATCH')
    assert.ok(report.blockers.includes('Malformed Payload migration evidence exists'))
    assert.equal(report.malformedPayloadMigrationRecords.length, 1)
    assert.equal(report.malformedPayloadMigrationRecords[0].rowIndex, 0)
    assert.equal(report.malformedPayloadMigrationRecords[0].reason, 'invalid_batch')
    // The malformed row must not appear in payloadMigrationRecords
    assert.equal(report.payloadMigrationRecords.some((r) => r.batch === -1), false)
  })

  // ─── Defect 1: malformed Payload evidence ─────────────────────────────────────

  const TARGET_MIG = PAYLOAD_MIGRATION_NAMES[PAYLOAD_MIGRATION_NAMES.length - 1]
  const NON_TARGET_MIG = PAYLOAD_MIGRATION_NAMES[0]
  const allAppliedPrisma = REGISTERED_PRISMA_MIGRATIONS.map((name) => appliedPrisma(name))

  function malformedAdapter(payloadMigrations: Array<{ name: unknown; batch: unknown }>): MigrationEvidenceAdapter {
    return {
      async collectMigrationEvidence() {
        return {
          schemaIdentity: 'jpvbootcamp_staging',
          payloadMigrations: payloadMigrations as Array<{ name: string; batch: number }>,
          prismaMigrations: allAppliedPrisma,
        }
      },
    }
  }

  await test('malformed: migration 29 row with null batch is classified malformed', async () => {
    const rows = PAYLOAD_MIGRATION_NAMES.map((name) => ({ name, batch: 1 }))
    rows[rows.length - 1] = { name: TARGET_MIG, batch: null as unknown as number }
    const report = await buildStagingMigrationStatus(malformedAdapter(rows), 'jpvbootcamp_staging')
    assert.equal(report.result, 'MISMATCH')
    assert.ok(report.blockers.includes('Malformed Payload migration evidence exists'))
    assert.ok(report.malformedPayloadMigrationRecords.some((r) => r.reason === 'invalid_batch'))
  })

  await test('malformed: migration 29 row with negative batch is classified malformed', async () => {
    const rows = PAYLOAD_MIGRATION_NAMES.map((name, i) => ({ name, batch: i === PAYLOAD_MIGRATION_NAMES.length - 1 ? -1 : 1 }))
    const report = await buildStagingMigrationStatus(malformedAdapter(rows), 'jpvbootcamp_staging')
    assert.ok(report.blockers.includes('Malformed Payload migration evidence exists'))
    assert.ok(report.malformedPayloadMigrationRecords.some((r) => r.reason === 'invalid_batch'))
    assert.equal(report.payloadMigrationRecords.some((r) => r.name === TARGET_MIG), false)
  })

  await test('malformed: migration 29 row with fractional batch is classified malformed', async () => {
    const rows = PAYLOAD_MIGRATION_NAMES.map((name, i) => ({ name, batch: i === PAYLOAD_MIGRATION_NAMES.length - 1 ? 1.5 : 1 }))
    const report = await buildStagingMigrationStatus(malformedAdapter(rows), 'jpvbootcamp_staging')
    assert.ok(report.blockers.includes('Malformed Payload migration evidence exists'))
  })

  await test('valid: migration 29 row with numeric string batch (from node-postgres) is normalized and accepted', async () => {
    const rows = PAYLOAD_MIGRATION_NAMES.map((name, i) => ({ name, batch: i === PAYLOAD_MIGRATION_NAMES.length - 1 ? '1' : 1 }))
    const report = await buildStagingMigrationStatus(malformedAdapter(rows), 'jpvbootcamp_staging')
    // When all Payload migrations have valid batches (including node-postgres string normalization) and all Prisma migrations are applied,
    // the report should be VERIFIED with no blockers
    assert.equal(report.result, 'VERIFIED')
    assert.equal(report.blockers.length, 0)
    assert.equal(report.appliedPayloadMigrations.includes(TARGET_MIG), true)
    assert.equal(report.payloadMigrationRecords.some((r) => r.name === TARGET_MIG && r.batch === 1), true)
  })

  await test('malformed: migration 29 row with non-numeric string batch is classified malformed', async () => {
    const rows = PAYLOAD_MIGRATION_NAMES.map((name, i) => ({ name, batch: i === PAYLOAD_MIGRATION_NAMES.length - 1 ? 'not-a-number' : 1 }))
    const report = await buildStagingMigrationStatus(malformedAdapter(rows), 'jpvbootcamp_staging')
    assert.ok(report.blockers.includes('Malformed Payload migration evidence exists'))
    assert.ok(report.malformedPayloadMigrationRecords.some((r) => r.reason === 'invalid_batch'))
  })

  await test('malformed: migration 29 row with empty name is classified malformed', async () => {
    const rows = PAYLOAD_MIGRATION_NAMES.map((name, i) => ({ name: i === PAYLOAD_MIGRATION_NAMES.length - 1 ? '' : name, batch: 1 }))
    const report = await buildStagingMigrationStatus(malformedAdapter(rows), 'jpvbootcamp_staging')
    assert.ok(report.blockers.includes('Malformed Payload migration evidence exists'))
    assert.ok(report.malformedPayloadMigrationRecords.some((r) => r.reason === 'invalid_name'))
  })

  await test('malformed: migration 29 row with non-string name is classified malformed', async () => {
    const rows = PAYLOAD_MIGRATION_NAMES.map((name, i) => ({ name: i === PAYLOAD_MIGRATION_NAMES.length - 1 ? null : name, batch: 1 }))
    const report = await buildStagingMigrationStatus(malformedAdapter(rows), 'jpvbootcamp_staging')
    assert.ok(report.blockers.includes('Malformed Payload migration evidence exists'))
    assert.ok(report.malformedPayloadMigrationRecords.some((r) => r.reason === 'invalid_name'))
  })

  await test('malformed: earlier migration with malformed batch blocks', async () => {
    const rows = PAYLOAD_MIGRATION_NAMES.map((name, i) => ({ name, batch: i === 0 ? -5 : 1 }))
    const report = await buildStagingMigrationStatus(malformedAdapter(rows), 'jpvbootcamp_staging')
    assert.ok(report.blockers.includes('Malformed Payload migration evidence exists'))
    assert.ok(report.malformedPayloadMigrationRecords.some((r) => r.rowIndex === 0 && r.reason === 'invalid_batch'))
  })

  await test('malformed: malformed row plus a valid duplicate row — both classified', async () => {
    // Row 0 has invalid batch, row n+1 duplicates NON_TARGET_MIG name → both malformed
    const rows: Array<{ name: unknown; batch: unknown }> = [
      { name: NON_TARGET_MIG, batch: 0 }, // batch=0 is invalid (must be >= 1)
      ...PAYLOAD_MIGRATION_NAMES.slice(1).map((name) => ({ name, batch: 1 })),
      { name: NON_TARGET_MIG, batch: 1 }, // duplicate name
    ]
    const report = await buildStagingMigrationStatus(malformedAdapter(rows), 'jpvbootcamp_staging')
    assert.ok(report.blockers.includes('Malformed Payload migration evidence exists'))
    assert.ok(report.malformedPayloadMigrationRecords.length >= 2)
  })

  await test('malformed: a malformed row for migration 29 never masquerades as expected pending migration', async () => {
    // 28 valid + migration 29 with null batch — 29 must not count as applied
    const first28 = PAYLOAD_MIGRATION_NAMES.slice(0, -1)
    const rows = [
      ...first28.map((name) => ({ name, batch: 1 })),
      { name: TARGET_MIG, batch: null as unknown as number },
    ]
    const report = await buildStagingMigrationStatus(malformedAdapter(rows), 'jpvbootcamp_staging')
    assert.ok(report.blockers.includes('Malformed Payload migration evidence exists'))
    // The malformed row must not appear in applied list
    assert.equal(report.appliedPayloadMigrations.includes(TARGET_MIG), false)
    // missingPayloadMigrations must still list migration 29
    assert.ok(report.missingPayloadMigrations.includes(TARGET_MIG))
  })

  await test('malformed: raw unknown values never appear in operator output', async () => {
    const rows: Array<{ name: unknown; batch: unknown }> = [
      { name: '\x00secret-control-char', batch: 1 },
      ...PAYLOAD_MIGRATION_NAMES.map((name) => ({ name, batch: 1 })),
    ]
    const report = await buildStagingMigrationStatus(malformedAdapter(rows), 'jpvbootcamp_staging')
    const serialized = JSON.stringify(report)
    assert.equal(serialized.includes('\x00'), false)
    assert.equal(serialized.includes('secret-control-char'), false)
    assert.ok(report.blockers.includes('Malformed Payload migration evidence exists'))
  })

  await test('empty Prisma evidence cannot produce a verified report', async () => {
    const adapter: MigrationEvidenceAdapter = {
      async collectMigrationEvidence() {
        return {
          schemaIdentity: 'jpvbootcamp_staging',
          payloadMigrations: PAYLOAD_MIGRATION_NAMES.map((name) => ({ name, batch: 1 })),
          prismaMigrations: [],
        }
      },
    }
    const report = await buildStagingMigrationStatus(adapter, 'jpvbootcamp_staging')
    assert.equal(report.result, 'MISMATCH')
    assert.ok(report.blockers.includes('Prisma migration evidence is empty'))
    assert.deepEqual(report.missingPrismaMigrations, REGISTERED_PRISMA_MIGRATIONS)
  })

  await test('an arbitrary applied Prisma row cannot substitute for the registered inventory', async () => {
    const adapter: MigrationEvidenceAdapter = {
      async collectMigrationEvidence() {
        return {
          schemaIdentity: 'jpvbootcamp_staging',
          payloadMigrations: PAYLOAD_MIGRATION_NAMES.map((name) => ({ name, batch: 1 })),
          prismaMigrations: [appliedPrisma('20990101_arbitrary')],
        }
      },
    }
    const report = await buildStagingMigrationStatus(adapter, 'jpvbootcamp_staging')
    assert.equal(report.result, 'MISMATCH')
    assert.deepEqual(report.missingPrismaMigrations, REGISTERED_PRISMA_MIGRATIONS)
    assert.deepEqual(report.unexpectedPrismaMigrations, ['20990101_arbitrary'])
  })

  await test('Prisma state classification is fail closed', () => {
    assert.equal(classifyPrismaMigration(appliedPrisma()), 'applied')
    assert.equal(classifyPrismaMigration({ ...appliedPrisma(), has_logs: true }), 'applied')
    assert.equal(classifyPrismaMigration({ ...appliedPrisma(), finished_at: null }), 'in-progress')
    assert.equal(classifyPrismaMigration({ ...appliedPrisma(), rolled_back_at: '2026-08-02T00:00:00Z' }), 'rolled-back')
    assert.equal(classifyPrismaMigration({ ...appliedPrisma(), started_at: null }), 'unexpected')
  })

  await test('Prisma state with numeric string applied_steps_count (from node-postgres) is normalized and accepted', () => {
    const row = appliedPrisma()
    assert.equal(classifyPrismaMigration({ ...row, applied_steps_count: '1' as unknown as number }), 'applied')
    assert.equal(classifyPrismaMigration({ ...row, applied_steps_count: '5' as unknown as number }), 'applied')
  })

  await test('Prisma state with non-numeric string applied_steps_count is classified unexpected', () => {
    const row = appliedPrisma()
    assert.equal(classifyPrismaMigration({ ...row, applied_steps_count: 'not-a-number' as unknown as number }), 'unexpected')
  })

  await test('Prisma migrations with execution logs and completed state are applied (regression: staging shape)', () => {
    const completedWithLogs = appliedPrisma()
    assert.equal(classifyPrismaMigration({ ...completedWithLogs, has_logs: true }), 'applied')
    assert.equal(classifyPrismaMigration({ ...completedWithLogs, has_logs: true, applied_steps_count: 5 }), 'applied')
    const incompleteWithLogs = appliedPrisma()
    assert.equal(classifyPrismaMigration({ ...incompleteWithLogs, has_logs: true, finished_at: null }), 'in-progress')
    assert.equal(classifyPrismaMigration({ ...incompleteWithLogs, has_logs: true, rolled_back_at: '2026-08-02T00:00:00Z' }), 'rolled-back')
  })

  await test('database helper strips schema and preserves redacted metadata only', () => {
    const config = resolveDatabaseConnectionConfig(
      'postgres://user:secret@localhost/example?sslmode=require&schema=jpvbootcamp_staging',
      undefined,
    )
    assert.equal(config.schema, 'jpvbootcamp_staging')
    assert.equal(config.connectionString.includes('schema='), false)
    assert.equal(config.connectionString.includes('sslmode=require'), true)
    assert.equal(config.metadata.credentialsPresent, true)
    assert.equal(JSON.stringify(config.metadata).includes('secret'), false)
  })

  await test('database helper returns unconfigured when DATABASE_URL is absent', () => {
    const config = resolveDatabaseConnectionConfig(undefined, undefined)
    assert.equal(config.metadata.configured, false)
    assert.equal(config.metadata.schemaSource, 'unconfigured')
    assert.equal(config.connectionString, '')
  })

  await test('database helper uses url schema when present', () => {
    const config = resolveDatabaseConnectionConfig('postgres://localhost/db?schema=jpvbootcamp_staging', undefined)
    assert.equal(config.schema, 'jpvbootcamp_staging')
    assert.equal(config.metadata.schemaSource, 'url')
    assert.equal(config.metadata.configured, true)
  })

  await test('database helper accepts override over url schema', () => {
    const config = resolveDatabaseConnectionConfig('postgres://localhost/db?schema=jpvbootcamp_staging', 'jpvbootcamp_staging')
    assert.equal(config.schema, 'jpvbootcamp_staging')
    assert.equal(config.metadata.schemaSource, 'override')
  })

  await test('validateDatabaseSchemaIdentifier rejects unsafe values', () => {
    assert.throws(() => validateDatabaseSchemaIdentifier('bad-schema'))
    assert.throws(() => validateDatabaseSchemaIdentifier(''))
  })

  await test('database helper fails closed on malformed URL — does not return partial config', () => {
    // Malformed URL with potential credential material must fail closed, not silently return.
    // The new structural validator throws on any URL that cannot be parsed as valid PostgreSQL.
    const malformed = 'not a valid database URL with user:synthetic-secret'
    assert.throws(
      () => resolveDatabaseConnectionConfig(malformed, 'jpvbootcamp_staging'),
      /not a valid URL|must use PostgreSQL/,
    )
  })

  await test('CLI parser supports equals and space forms with acknowledgement', () => {
    assert.deepEqual(parseCliArgs([
      '--mode=staging-read-only',
      '--expected-schema=jpvbootcamp_staging',
      '--acknowledge-read-only',
    ]), {
      help: false,
      mode: 'staging-read-only',
      expectedSchema: 'jpvbootcamp_staging',
      acknowledgeReadOnly: true,
    })
    assert.equal(parseCliArgs([
      '--mode', 'staging-read-only',
      '--expected-schema', 'jpvbootcamp_staging',
      '--acknowledge-read-only',
    ]).expectedSchema, 'jpvbootcamp_staging')
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
      '--expected-schema=jpvbootcamp_staging',
      '--acknowledge-read-only',
    ], {
      DATABASE_URL: 'postgres://localhost/db?schema=jpvbootcamp_staging',
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
      '--expected-schema=jpvbootcamp_staging',
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
      databaseUrl: 'postgres://user:secret@localhost/db?schema=jpvbootcamp_staging',
      expectedSchema: 'jpvbootcamp_staging',
      clientFactory,
    })
    const report = await buildStagingMigrationStatus(adapter, 'jpvbootcamp_staging')
    assert.equal(report.result, 'VERIFIED')
    assert.equal(factoryCalls.length, 1)
    assert.equal(factoryCalls[0].connectionString.includes('schema='), false)
    assert.equal(client.connectCalls, 1)
    assert.equal(client.connected, true)
    assert.equal(client.endCalls, 1)
    assert.equal(client.ended, true)
    assert.equal(client.queries.filter((query) => query === 'BEGIN TRANSACTION READ ONLY').length, 1)
    assert.equal(client.queries.filter((query) => query === "SET LOCAL statement_timeout = '5000ms'").length, 1)
    assert.equal(client.queries.filter((query) => query === 'SET LOCAL search_path TO "jpvbootcamp_staging"').length, 1)
    assert.equal(client.queries.at(-1), 'ROLLBACK')
    const schemaIndex = client.queries.indexOf('SELECT current_schema() AS current_schema')
    const payloadIndex = client.queries.findIndex((query) => query.includes('.payload_migrations'))
    const prismaIndex = client.queries.findIndex((query) => query.includes('._prisma_migrations'))
    assert.ok(schemaIndex >= 0 && schemaIndex < payloadIndex && payloadIndex < prismaIndex)
    assert.match(client.queries[payloadIndex], /^SELECT name, batch FROM "jpvbootcamp_staging"\.payload_migrations ORDER BY id ASC$/)
    assert.match(client.queries[prismaIndex], /\(logs IS NOT NULL\) AS has_logs/)
    assert.equal(client.queries[prismaIndex].includes('SELECT *'), false)
    assert.equal(client.queries[prismaIndex].includes('SELECT logs'), false)
  })

  await test('schema mismatch prevents migration metadata queries and still rolls back', async () => {
    const client = new RecordingClient()
    client.schema = 'wrong_schema'
    const adapter = createStagingReadOnlyAdapter({
      databaseUrl: 'postgres://localhost/db?schema=jpvbootcamp_staging',
      expectedSchema: 'jpvbootcamp_staging',
      clientFactory: () => client,
    })
    await assert.rejects(() => buildStagingMigrationStatus(adapter, 'jpvbootcamp_staging'), /Database-reported schema/)
    assert.equal(client.queries.some((query) => query.includes('.payload_migrations')), false)
    assert.equal(client.queries.at(-1), 'ROLLBACK')
    assert.equal(client.ended, true)
  })

  await test('query failure is secret-safe, rolls back, and closes', async () => {
    const client = new RecordingClient()
    client.failOn = '.payload_migrations'
    const adapter = createStagingReadOnlyAdapter({
      databaseUrl: 'postgres://user:secret@localhost/db?schema=jpvbootcamp_staging',
      expectedSchema: 'jpvbootcamp_staging',
      clientFactory: () => client,
    })
    let message = ''
    try {
      await buildStagingMigrationStatus(adapter, 'jpvbootcamp_staging')
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
      databaseUrl: 'postgres://localhost/db?schema=jpvbootcamp_staging',
      expectedSchema: 'jpvbootcamp_staging',
      clientFactory: () => client,
    })
    await assert.rejects(
      () => buildStagingMigrationStatus(adapter, 'jpvbootcamp_staging'),
      /^Error: Read-only staging migration query failed$/,
    )
    assert.equal(client.queries.at(-1), 'ROLLBACK')
    assert.equal(client.ended, true)
  })

  await test('configured schema mismatch fails before client construction', () => {
    let constructed = false
    assert.throws(() => createStagingReadOnlyAdapter({
      databaseUrl: 'postgres://localhost/db?schema=other_schema',
      expectedSchema: 'jpvbootcamp_staging',
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
      databaseUrl: 'mysql://localhost/db?schema=jpvbootcamp_staging',
      expectedSchema: 'jpvbootcamp_staging',
      clientFactory,
    }), /must use PostgreSQL/)
    assert.throws(() => createStagingReadOnlyAdapter({
      databaseUrl: 'not-a-url',
      expectedSchema: 'jpvbootcamp_staging',
      schemaOverride: 'jpvbootcamp_staging',
      clientFactory,
    }), /must use PostgreSQL/)
    assert.throws(() => createStagingReadOnlyAdapter({
      databaseUrl: 'postgres://localhost/db?schema=jpvbootcamp_staging',
      expectedSchema: 'jpvbootcamp_staging',
      statementTimeoutMillis: 0,
      clientFactory,
    }), /Statement timeout/)
    assert.equal(constructed, 0)
  })

  await test('connect failure is redacted and still closes the constructed client', async () => {
    const client = new RecordingClient()
    client.failConnect = true
    const adapter = createStagingReadOnlyAdapter({
      databaseUrl: 'postgres://user:secret@localhost/db?schema=jpvbootcamp_staging',
      expectedSchema: 'jpvbootcamp_staging',
      clientFactory: () => client,
    })
    let message = ''
    try {
      await buildStagingMigrationStatus(adapter, 'jpvbootcamp_staging')
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
      databaseUrl: 'postgres://localhost/db?schema=jpvbootcamp_staging',
      expectedSchema: 'jpvbootcamp_staging',
      clientFactory: () => client,
    })
    await assert.rejects(
      () => buildStagingMigrationStatus(adapter, 'jpvbootcamp_staging'),
      /^Error: Read-only staging migration rollback failed$/,
    )
    assert.equal(client.endCalls, 1)
    assert.equal(client.ended, true)
  })

  await test('connection close failure is generic and contains no injected secret', async () => {
    const client = new RecordingClient()
    client.failEnd = true
    const adapter = createStagingReadOnlyAdapter({
      databaseUrl: 'postgres://localhost/db?schema=jpvbootcamp_staging',
      expectedSchema: 'jpvbootcamp_staging',
      clientFactory: () => client,
    })
    let message = ''
    try {
      await buildStagingMigrationStatus(adapter, 'jpvbootcamp_staging')
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
