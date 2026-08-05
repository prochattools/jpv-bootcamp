import assert from 'node:assert/strict'

import { PAYLOAD_MIGRATION_NAMES } from '../../src/migrations/migrationRegistry'
import {
  runStagingMigrationPlan,
  runStagingMigrationApply,
  parseApplyCliArgs,
  type MigrationAuthorizationPacket,
  type StagingMigrationRunnerDependencies,
} from './runStagingPayloadMigration'
import {
  type MigrationEvidenceAdapter,
  type PgClientFactory,
  type PgClientLike,
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

const REQUIRED_BRANCH = 'feature/course-branding-and-preview'
const REQUIRED_COMMIT = '969113bcbee5cbdc01a274d7ab3e5cafdc94ecca'
const REQUIRED_SCHEMA = 'jpvbootcamp_staging'
const TARGET_MIGRATION = '20260804_050000_member_account_action_reservations'
const APPLY_CONFIRMATION = 'apply_account_action_reservation_migration_to_jpvbootcamp_staging'
const EXPECTED_APPLIED_BEFORE = 28
const EXPECTED_APPLIED_AFTER = 29

// Migrations 1–28 (all except migration 29)
const FIRST_28 = PAYLOAD_MIGRATION_NAMES.filter((n) => n !== TARGET_MIGRATION)
// All 29
const ALL_29 = PAYLOAD_MIGRATION_NAMES

assert.equal(FIRST_28.length, EXPECTED_APPLIED_BEFORE, 'Registry must have exactly 28 non-target migrations')
assert.equal(ALL_29.length, EXPECTED_APPLIED_AFTER, 'Registry must have exactly 29 migrations')
assert.equal(ALL_29[ALL_29.length - 1], TARGET_MIGRATION, 'Target migration must be last in registry')

function okGit(): StagingMigrationRunnerDependencies['gitResolver'] {
  return { branch: () => REQUIRED_BRANCH, commit: () => REQUIRED_COMMIT }
}

function noopOutput(): (line: string) => void {
  return () => {}
}

type PgRow = Record<string, unknown>

function make28AppliedClient(schema: string): PgClientLike {
  return {
    async connect() {},
    async query<R extends PgRow = PgRow>(text: string): Promise<{ rows: R[] }> {
      if (text.includes('current_schema()')) {
        return { rows: [{ current_schema: schema }] as unknown as R[] }
      }
      if (text.includes('.payload_migrations')) {
        return {
          rows: FIRST_28.map((name) => ({ name, batch: 1 })) as unknown as R[],
        }
      }
      if (text.includes('._prisma_migrations')) {
        return { rows: [] as unknown as R[] }
      }
      if (text.includes('BEGIN') || text.includes('SET LOCAL') || text.includes('ROLLBACK')) {
        return { rows: [] as unknown as R[] }
      }
      return { rows: [] as unknown as R[] }
    },
    async end() {},
  }
}

function make29AppliedClient(schema: string): PgClientLike {
  return {
    async connect() {},
    async query<R extends PgRow = PgRow>(text: string): Promise<{ rows: R[] }> {
      if (text.includes('current_schema()')) {
        return { rows: [{ current_schema: schema }] as unknown as R[] }
      }
      if (text.includes('.payload_migrations')) {
        return {
          rows: ALL_29.map((name) => ({ name, batch: 1 })) as unknown as R[],
        }
      }
      if (text.includes('._prisma_migrations')) {
        return { rows: [] as unknown as R[] }
      }
      if (text.includes('BEGIN') || text.includes('SET LOCAL') || text.includes('ROLLBACK')) {
        return { rows: [] as unknown as R[] }
      }
      return { rows: [] as unknown as R[] }
    },
    async end() {},
  }
}

function clientFactory28(schema: string): PgClientFactory {
  return (_config) => make28AppliedClient(schema)
}

function clientFactory29(schema: string): PgClientFactory {
  return (_config) => make29AppliedClient(schema)
}

let preCallCount = 0
let postCallCount = 0
function clientFactorySequence(schema: string): PgClientFactory {
  // First call returns 28 applied (pre-apply); second returns 29 applied (post-apply)
  let callIndex = 0
  return (_config) => {
    const index = callIndex++
    if (index === 0) {
      preCallCount++
      return make28AppliedClient(schema)
    }
    postCallCount++
    return make29AppliedClient(schema)
  }
}

function goodAuthorization(): MigrationAuthorizationPacket {
  return {
    operatorId: 'test-operator',
    backupEvidenceId: 'backup-2026-08-04-001',
    maintenanceWindowId: 'mw-2026-08-04',
    rollbackOwner: 'test-operator',
    confirmation: APPLY_CONFIRMATION,
  }
}

function okApplyExecutor(exitStatus = 0): StagingMigrationRunnerDependencies['commandExecutor'] {
  return (_command: string, _args: string[]) => ({ status: exitStatus })
}

async function run(): Promise<void> {
  // --- parseApplyCliArgs ---

  await test('parseApplyCliArgs: parses all required fields', () => {
    const result = parseApplyCliArgs([
      '--operator-id=ops',
      '--backup-evidence-id=bk1',
      '--maintenance-window-id=mw1',
      '--rollback-owner=ops',
      `--confirmation=${APPLY_CONFIRMATION}`,
    ])
    assert.equal(result.operatorId, 'ops')
    assert.equal(result.backupEvidenceId, 'bk1')
    assert.equal(result.maintenanceWindowId, 'mw1')
    assert.equal(result.rollbackOwner, 'ops')
    assert.equal(result.confirmation, APPLY_CONFIRMATION)
  })

  await test('parseApplyCliArgs: rejects missing operatorId', () => {
    assert.throws(() =>
      parseApplyCliArgs([
        '--backup-evidence-id=bk1',
        '--maintenance-window-id=mw1',
        '--rollback-owner=ops',
        `--confirmation=${APPLY_CONFIRMATION}`,
      ]),
    )
  })

  await test('parseApplyCliArgs: rejects missing confirmation', () => {
    assert.throws(() =>
      parseApplyCliArgs([
        '--operator-id=ops',
        '--backup-evidence-id=bk1',
        '--maintenance-window-id=mw1',
        '--rollback-owner=ops',
      ]),
    )
  })

  await test('parseApplyCliArgs: rejects unknown arguments', () => {
    assert.throws(() =>
      parseApplyCliArgs([
        '--unknown-flag=value',
        '--operator-id=ops',
      ]),
    )
  })

  await test('parseApplyCliArgs: rejects positional arguments', () => {
    assert.throws(() => parseApplyCliArgs(['positional']))
  })

  // --- runStagingMigrationPlan: branch/commit guards ---

  await test('plan: rejects wrong branch', async () => {
    const result = await runStagingMigrationPlan(
      'postgres://host/jpvbootcamp?schema=jpvbootcamp_staging',
      undefined,
      { gitResolver: { branch: () => 'main', commit: () => REQUIRED_COMMIT } },
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.length > 0)
    assert.ok(result.blockers[0].toLowerCase().includes('branch'))
  })

  await test('plan: rejects wrong commit', async () => {
    const result = await runStagingMigrationPlan(
      'postgres://host/jpvbootcamp?schema=jpvbootcamp_staging',
      undefined,
      { gitResolver: { branch: () => REQUIRED_BRANCH, commit: () => 'deadbeef' } },
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('commit')))
  })

  await test('plan: rejects missing DATABASE_URL', async () => {
    const result = await runStagingMigrationPlan(
      undefined,
      undefined,
      { gitResolver: okGit() },
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.includes('DATABASE_URL')))
  })

  await test('plan: returns ok when 28 applied and only migration 29 missing', async () => {
    const result = await runStagingMigrationPlan(
      `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
      undefined,
      {
        gitResolver: okGit(),
        clientFactory: clientFactory28(REQUIRED_SCHEMA),
      },
      noopOutput(),
    )
    assert.equal(result.ok, true)
    assert.equal(result.appliedCount, EXPECTED_APPLIED_BEFORE)
    assert.deepEqual(result.pendingMigrations, [TARGET_MIGRATION])
    assert.equal(result.blockers.length, 0)
  })

  await test('plan: blocks when applied count is not 28', async () => {
    // Simulate 27 applied (all 28 except the first)
    const all27 = FIRST_28.slice(1)
    const client27: PgClientLike = {
      async connect() {},
      async query<R extends PgRow = PgRow>(text: string): Promise<{ rows: R[] }> {
        if (text.includes('current_schema()')) return { rows: [{ current_schema: REQUIRED_SCHEMA }] as unknown as R[] }
        if (text.includes('.payload_migrations')) return { rows: all27.map((name) => ({ name, batch: 1 })) as unknown as R[] }
        return { rows: [] as unknown as R[] }
      },
      async end() {},
    }
    const result = await runStagingMigrationPlan(
      `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
      undefined,
      { gitResolver: okGit(), clientFactory: () => client27 },
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.includes('28')))
  })

  await test('plan: blocks when migration 29 is already applied', async () => {
    const result = await runStagingMigrationPlan(
      `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
      undefined,
      { gitResolver: okGit(), clientFactory: clientFactory29(REQUIRED_SCHEMA) },
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.includes(TARGET_MIGRATION) || b.includes('missing')))
  })

  await test('plan: blocks when unexpected migrations exist', async () => {
    const client: PgClientLike = {
      async connect() {},
      async query<R extends PgRow = PgRow>(text: string): Promise<{ rows: R[] }> {
        if (text.includes('current_schema()')) return { rows: [{ current_schema: REQUIRED_SCHEMA }] as unknown as R[] }
        if (text.includes('.payload_migrations')) {
          return {
            rows: [
              ...FIRST_28.map((name) => ({ name, batch: 1 })),
              { name: 'unexpected_migration', batch: 1 },
            ] as unknown as R[],
          }
        }
        return { rows: [] as unknown as R[] }
      },
      async end() {},
    }
    const result = await runStagingMigrationPlan(
      `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
      undefined,
      { gitResolver: okGit(), clientFactory: () => client },
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('unexpected')))
  })

  // --- runStagingMigrationApply: authorization guards ---

  await test('apply: rejects wrong branch', async () => {
    await assert.rejects(
      () =>
        runStagingMigrationApply(
          `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
          undefined,
          goodAuthorization(),
          {
            gitResolver: { branch: () => 'main', commit: () => REQUIRED_COMMIT },
            clientFactory: clientFactory28(REQUIRED_SCHEMA),
            commandExecutor: okApplyExecutor(),
          },
          noopOutput(),
        ),
      /branch/i,
    )
  })

  await test('apply: rejects wrong commit', async () => {
    await assert.rejects(
      () =>
        runStagingMigrationApply(
          `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
          undefined,
          goodAuthorization(),
          {
            gitResolver: { branch: () => REQUIRED_BRANCH, commit: () => 'wrongcommit' },
            clientFactory: clientFactory28(REQUIRED_SCHEMA),
            commandExecutor: okApplyExecutor(),
          },
          noopOutput(),
        ),
      /commit/i,
    )
  })

  await test('apply: rejects missing operatorId in authorization', async () => {
    const badAuth = { ...goodAuthorization(), operatorId: '' }
    await assert.rejects(
      () =>
        runStagingMigrationApply(
          `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
          undefined,
          badAuth,
          { gitResolver: okGit(), clientFactory: clientFactory28(REQUIRED_SCHEMA), commandExecutor: okApplyExecutor() },
          noopOutput(),
        ),
      /operatorId/i,
    )
  })

  await test('apply: rejects wrong confirmation value', async () => {
    const badAuth = { ...goodAuthorization(), confirmation: 'wrong-value' }
    await assert.rejects(
      () =>
        runStagingMigrationApply(
          `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
          undefined,
          badAuth,
          { gitResolver: okGit(), clientFactory: clientFactory28(REQUIRED_SCHEMA), commandExecutor: okApplyExecutor() },
          noopOutput(),
        ),
      /confirmation/i,
    )
  })

  await test('apply: rejects missing DATABASE_URL', async () => {
    await assert.rejects(
      () =>
        runStagingMigrationApply(
          undefined,
          undefined,
          goodAuthorization(),
          { gitResolver: okGit(), clientFactory: clientFactory28(REQUIRED_SCHEMA), commandExecutor: okApplyExecutor() },
          noopOutput(),
        ),
      /DATABASE_URL/i,
    )
  })

  await test('apply: rejects when pre-apply count is not 28', async () => {
    await assert.rejects(
      () =>
        runStagingMigrationApply(
          `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
          undefined,
          goodAuthorization(),
          {
            gitResolver: okGit(),
            clientFactory: clientFactory29(REQUIRED_SCHEMA),
            commandExecutor: okApplyExecutor(),
          },
          noopOutput(),
        ),
      /pre-apply check failed/i,
    )
  })

  await test('apply: rejects when migration command exits non-zero', async () => {
    await assert.rejects(
      () =>
        runStagingMigrationApply(
          `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
          undefined,
          goodAuthorization(),
          {
            gitResolver: okGit(),
            clientFactory: clientFactory28(REQUIRED_SCHEMA),
            commandExecutor: okApplyExecutor(1),
          },
          noopOutput(),
        ),
      /Migration command exited/i,
    )
  })

  await test('apply: succeeds with valid authorization, passing pre-apply check, zero-exit command, and passing post-apply check', async () => {
    let commandCalled = false
    let commandArgs: string[] = []
    const factory = clientFactorySequence(REQUIRED_SCHEMA)
    preCallCount = 0
    postCallCount = 0

    const result = await runStagingMigrationApply(
      `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
      undefined,
      goodAuthorization(),
      {
        gitResolver: okGit(),
        clientFactory: factory,
        commandExecutor: (cmd, args) => {
          commandCalled = true
          commandArgs = [cmd, ...args]
          return { status: 0 }
        },
      },
      noopOutput(),
    )

    assert.equal(result.ok, true)
    assert.equal(result.mode, 'apply')
    assert.equal(result.branch, REQUIRED_BRANCH)
    assert.equal(result.commit, REQUIRED_COMMIT)
    assert.equal(result.schema, REQUIRED_SCHEMA)
    assert.equal(result.authorization.operatorId, 'test-operator')
    assert.equal(result.preApply.appliedCount, EXPECTED_APPLIED_BEFORE)
    assert.deepEqual(result.preApply.missingMigrations, [TARGET_MIGRATION])
    assert.equal(result.postApply.appliedCount, EXPECTED_APPLIED_AFTER)
    assert.deepEqual(result.postApply.missingMigrations, [])
    assert.ok(commandCalled, 'migration command must be invoked')
    assert.ok(commandArgs.includes('migrate'), 'command must invoke payload migrate')
  })

  await test('apply: result does not expose confirmation value in return object', async () => {
    const factory = clientFactorySequence(REQUIRED_SCHEMA)
    const result = await runStagingMigrationApply(
      `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
      undefined,
      goodAuthorization(),
      {
        gitResolver: okGit(),
        clientFactory: factory,
        commandExecutor: okApplyExecutor(),
      },
      noopOutput(),
    )
    const serialized = JSON.stringify(result)
    assert.ok(
      !serialized.includes(APPLY_CONFIRMATION),
      'Confirmation value must not appear in serialized result',
    )
  })

  await test('apply: post-apply verification fails when command claims success but DB still shows 28', async () => {
    // Both pre and post queries return 28 applied (command claims to succeed but DB not updated)
    await assert.rejects(
      () =>
        runStagingMigrationApply(
          `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
          undefined,
          goodAuthorization(),
          {
            gitResolver: okGit(),
            clientFactory: clientFactory28(REQUIRED_SCHEMA),
            commandExecutor: okApplyExecutor(),
          },
          noopOutput(),
        ),
      /post-apply verification failed/i,
    )
  })

  await test('plan: output lines do not contain DATABASE_URL value', async () => {
    const lines: string[] = []
    const sensitiveUrl = 'postgres://user:secret-password@host:5432/jpvbootcamp?schema=jpvbootcamp_staging'
    await runStagingMigrationPlan(
      sensitiveUrl,
      undefined,
      {
        gitResolver: okGit(),
        clientFactory: clientFactory28(REQUIRED_SCHEMA),
      },
      (line) => lines.push(line),
    )
    for (const line of lines) {
      assert.ok(
        !line.includes('secret-password'),
        `Output must not contain credentials: ${line}`,
      )
    }
  })

  await test('plan: mode field is always plan', async () => {
    const result = await runStagingMigrationPlan(
      undefined,
      undefined,
      { gitResolver: okGit() },
      noopOutput(),
    )
    assert.equal(result.mode, 'plan')
  })

  await test('apply: missing backupEvidenceId throws', async () => {
    const badAuth = { ...goodAuthorization(), backupEvidenceId: '' }
    await assert.rejects(
      () =>
        runStagingMigrationApply(
          `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
          undefined,
          badAuth,
          { gitResolver: okGit(), clientFactory: clientFactory28(REQUIRED_SCHEMA), commandExecutor: okApplyExecutor() },
          noopOutput(),
        ),
      /backupEvidenceId/i,
    )
  })

  await test('apply: missing maintenanceWindowId throws', async () => {
    const badAuth = { ...goodAuthorization(), maintenanceWindowId: '' }
    await assert.rejects(
      () =>
        runStagingMigrationApply(
          `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
          undefined,
          badAuth,
          { gitResolver: okGit(), clientFactory: clientFactory28(REQUIRED_SCHEMA), commandExecutor: okApplyExecutor() },
          noopOutput(),
        ),
      /maintenanceWindowId/i,
    )
  })

  await test('apply: missing rollbackOwner throws', async () => {
    const badAuth = { ...goodAuthorization(), rollbackOwner: '' }
    await assert.rejects(
      () =>
        runStagingMigrationApply(
          `postgres://host/jpvbootcamp?schema=${REQUIRED_SCHEMA}`,
          undefined,
          badAuth,
          { gitResolver: okGit(), clientFactory: clientFactory28(REQUIRED_SCHEMA), commandExecutor: okApplyExecutor() },
          noopOutput(),
        ),
      /rollbackOwner/i,
    )
  })
}

async function main(): Promise<void> {
  await run()
  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error) => {
  console.error('Test runner error:', error)
  process.exitCode = 1
})
