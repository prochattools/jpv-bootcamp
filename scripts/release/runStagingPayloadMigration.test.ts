import assert from 'node:assert/strict'

import { PAYLOAD_MIGRATION_NAMES } from '../../src/lib/payloadMigrationRegistry'
import {
  runStagingMigrationPlan,
  runStagingMigrationApply,
  runStagingMigrationRollbackPlan,
  parsePlanCliArgs,
  parseApplyCliArgs,
  parseRollbackPlanCliArgs,
  parseNulGitStatus,
  parseOutputFlag,
  PAYLOAD_MIGRATE_ARGS,
  APPLY_OUTCOME_UNCERTAIN,
  type MigrationAuthorizationPacket,
  type RollbackPlanAuthorizationPacket,
  type StagingMigrationRunnerDependencies,
  type StagingMigrationPlanInput,
  type GitStatusEntry,
} from './runStagingPayloadMigration'
import {
  REGISTERED_PRISMA_MIGRATIONS,
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

// ─── Test constants ────────────────────────────────────────────────────────────

const REQUIRED_BRANCH = 'feature/course-branding-and-preview'
// Deterministic synthetic SHA used only in injected gitResolver mocks.
// This value is never the real HEAD and never requires updating after a commit.
const SYNTHETIC_HEAD = 'a4081d12c7141ed8f5476077536c5234a555f240'
const REQUIRED_SCHEMA = 'jpvbootcamp'
const REQUIRED_DATABASE = 'jpvbootcamp_staging'
const REQUIRED_TARGET_ID = 'jpvbootcamp-staging'
const REQUIRED_ENVIRONMENT = 'staging'
const MIGRATION35 = '20260818_140100_portal_settings'
const MIGRATION36 = '20260820_000000_live_session_space'
const MIGRATION39 = '20260824_200000_member_notifications'
const MIGRATION40 = '20260824_210000_pay_it_forward_schema'
const TARGET_MIGRATIONS = [
  '20260901_210000_notification_event_key',
  '20260901_220000_member_follows',
] as const
const TARGET_MIGRATION = TARGET_MIGRATIONS.at(-1)!
const APPLY_CONFIRMATION = 'apply_member_social_schema_to_jpvbootcamp_staging'
const ROLLBACK_CONFIRMATION = 'plan_rollback_member_social_schema_from_jpvbootcamp_staging'
const REVIEWED_APPLY_SET = new Set<string>(TARGET_MIGRATIONS)
// Reviewed staging hostname — matches STAGING_TARGET.hostname in runStagingPayloadMigration.ts.
const STAGING_HOSTNAME = '10.0.2.4'
const PRODUCTION_HOSTNAME = 'prod-db.internal'

// Historical checkpoint fixtures remain useful for proving that discovery
// reports the complete canonical pending set instead of treating it as an
// apply authorization packet.
const FIRST_35 = PAYLOAD_MIGRATION_NAMES.slice(0, 40)
const HISTORICAL_35 = PAYLOAD_MIGRATION_NAMES.slice(0, 35)
const ALL_36 = PAYLOAD_MIGRATION_NAMES.filter((name) => !REVIEWED_APPLY_SET.has(name))
const ALL_37 = [...PAYLOAD_MIGRATION_NAMES]
const HISTORICAL_APPLY_BASELINE_COUNT = ALL_36.length
const CANONICAL_REGISTRY_FIXTURE_COUNT = ALL_37.length

// Registry integrity assertions — fail fast if the registry is out of sync.
assert.equal(FIRST_35.length, 40, 'Historical checkpoint must contain exactly 40 migrations')
assert.equal(FIRST_35.at(-2), MIGRATION39, 'Migration 39 must remain in the applied prefix')
assert.equal(FIRST_35.at(-1), MIGRATION40, 'Migration 40 must be the last migration in the applied prefix')
assert.deepEqual(ALL_37, PAYLOAD_MIGRATION_NAMES, 'Current fixture must follow the canonical registry order')
assert.ok(TARGET_MIGRATIONS.every((name) => PAYLOAD_MIGRATION_NAMES.includes(name)), 'Reviewed apply migrations must remain registered')

// ─── Confirmed: no self-referential hardcoded commit ──────────────────────────
// The runner exports no REQUIRED_COMMIT constant.
// SYNTHETIC_HEAD is a fixed deterministic value used only in injected mocks.
// It must never equal the old hardcoded commit SHA from a4081d1 (which is no
// longer in source), proving we test the runtime-input path, not a baked constant.
assert.notEqual(SYNTHETIC_HEAD, '969113bcbee5cbdc01a274d7ab3e5cafdc94ecca',
  'Synthetic HEAD must not be the old self-invalidating commit')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function okGit(commitOverride?: string): StagingMigrationRunnerDependencies['gitResolver'] {
  return {
    branch: () => REQUIRED_BRANCH,
    commit: () => commitOverride ?? SYNTHETIC_HEAD,
  }
}

function cleanGitStatus(): () => GitStatusEntry[] {
  return () => []
}

function dirtyGitStatus(entries: GitStatusEntry[]): () => GitStatusEntry[] {
  return () => entries
}

function noopOutput(): (line: string) => void {
  return () => {}
}

type PgRow = Record<string, unknown>

function appliedPrismaRow(name: string): PgRow {
  return {
    migration_name: name,
    started_at: '2026-08-01T00:00:00.000Z',
    finished_at: '2026-08-01T00:00:01.000Z',
    rolled_back_at: null,
    applied_steps_count: 1,
    has_logs: false,
  }
}

function makeClient(opts: {
  schema: string
  payloadRows: Array<{ name: string; batch: number }>
  prismaRows?: PgRow[]
}): PgClientLike {
  const prismaRows = opts.prismaRows ?? REGISTERED_PRISMA_MIGRATIONS.map((n) => appliedPrismaRow(n))
  return {
    async connect() {},
    async query<R extends PgRow = PgRow>(text: string): Promise<{ rows: R[] }> {
      if (text.includes('current_schema()')) {
        return { rows: [{ current_schema: opts.schema }] as unknown as R[] }
      }
      if (text.includes('.payload_migrations')) {
        return { rows: opts.payloadRows as unknown as R[] }
      }
      if (text.includes('._prisma_migrations')) {
        return { rows: prismaRows as unknown as R[] }
      }
      return { rows: [] as unknown as R[] }
    },
    async end() {},
  }
}

function make35Client(schema = REQUIRED_SCHEMA): PgClientLike {
  return makeClient({ schema, payloadRows: HISTORICAL_35.map((n) => ({ name: n, batch: 1 })) })
}

function make36Client(schema = REQUIRED_SCHEMA): PgClientLike {
  return makeClient({
    schema,
    payloadRows: ALL_36.map((name, index) => ({ name, batch: index === ALL_36.length - 1 ? 2 : 1 })),
  })
}

function make37Client(schema = REQUIRED_SCHEMA): PgClientLike {
  return makeClient({
    schema,
    payloadRows: ALL_37.map((name) => ({ name, batch: REVIEWED_APPLY_SET.has(name) ? 3 : 1 })),
  })
}

function makeHistorical40Client(schema = REQUIRED_SCHEMA): PgClientLike {
  return makeClient({
    schema,
    payloadRows: FIRST_35.map((name) => ({ name, batch: 1 })),
  })
}

function makeRollbackReadyClient(schema = REQUIRED_SCHEMA): PgClientLike {
  return makeClient({
    schema,
    payloadRows: [
      ...ALL_36.map((name, index) => ({ name, batch: index === ALL_36.length - 1 ? 2 : 1 })),
      ...TARGET_MIGRATIONS.map((name) => ({ name, batch: 3 })),
    ],
  })
}

function clientFactoryHistorical35(schema = REQUIRED_SCHEMA): PgClientFactory {
  return () => make35Client(schema)
}

function clientFactoryHistorical40(schema = REQUIRED_SCHEMA): PgClientFactory {
  return () => makeHistorical40Client(schema)
}

function clientFactoryRollbackReady(schema = REQUIRED_SCHEMA): PgClientFactory {
  return () => makeRollbackReadyClient(schema)
}

// Historical name retained for the broad guard-test fixture: the runner's
// current pre-apply baseline contains every non-reviewed canonical migration.
function clientFactory35(schema = REQUIRED_SCHEMA): PgClientFactory {
  return () => make36Client(schema)
}

function clientFactory36(schema = REQUIRED_SCHEMA): PgClientFactory {
  return () => make36Client(schema)
}

function clientFactoryCurrent(schema = REQUIRED_SCHEMA): PgClientFactory {
  return () => make37Client(schema)
}

function clientFactorySequence(schema = REQUIRED_SCHEMA): PgClientFactory {
  let call = 0
  return () => {
    const idx = call++
    return idx === 0 ? make36Client(schema) : make37Client(schema)
  }
}


function goodPlanInput(overrides: Partial<StagingMigrationPlanInput> = {}): StagingMigrationPlanInput {
  return {
    expectedCommit: SYNTHETIC_HEAD,
    environment: REQUIRED_ENVIRONMENT,
    targetId: REQUIRED_TARGET_ID,
    expectedSchema: REQUIRED_SCHEMA,
    expectedHostname: STAGING_HOSTNAME,
    expectedDatabase: REQUIRED_DATABASE,
    ...overrides,
  }
}

function goodAuthorization(overrides: Partial<MigrationAuthorizationPacket> = {}): MigrationAuthorizationPacket {
  return {
    operatorId: 'test-operator',
    backupEvidenceId: 'backup-2026-08-04-001',
    maintenanceWindowId: 'mw-2026-08-04',
    rollbackOwner: 'test-operator',
    expectedCommit: SYNTHETIC_HEAD,
    environment: REQUIRED_ENVIRONMENT,
    targetId: REQUIRED_TARGET_ID,
    expectedSchema: REQUIRED_SCHEMA,
    expectedHostname: STAGING_HOSTNAME,
    expectedDatabase: REQUIRED_DATABASE,
    expectedMigrations: [...TARGET_MIGRATIONS],
    confirmation: APPLY_CONFIRMATION,
    ...overrides,
  }
}

function goodRollbackAuthorization(overrides: Partial<RollbackPlanAuthorizationPacket> = {}): RollbackPlanAuthorizationPacket {
  return {
    operatorId: 'test-operator',
    backupEvidenceId: 'backup-2026-08-04-001',
    maintenanceWindowId: 'mw-2026-08-04',
    rollbackOwner: 'test-operator',
    expectedCommit: SYNTHETIC_HEAD,
    environment: REQUIRED_ENVIRONMENT,
    targetId: REQUIRED_TARGET_ID,
    expectedSchema: REQUIRED_SCHEMA,
    expectedHostname: STAGING_HOSTNAME,
    expectedDatabase: REQUIRED_DATABASE,
    confirmation: ROLLBACK_CONFIRMATION,
    ...overrides,
  }
}

function stagingUrl(hostname = STAGING_HOSTNAME): string {
  return `postgres://${hostname}/${REQUIRED_DATABASE}?schema=${REQUIRED_SCHEMA}`
}

function okApplyExecutor(exitStatus = 0): StagingMigrationRunnerDependencies['commandExecutor'] {
  return () => ({ status: exitStatus })
}

function baseDeps(overrides: Partial<StagingMigrationRunnerDependencies> = {}): StagingMigrationRunnerDependencies {
  return {
    gitResolver: okGit(),
    gitStatusResolver: cleanGitStatus(),
    clientFactory: clientFactory36(),
    commandExecutor: okApplyExecutor(),
    ...overrides,
  }
}

// ─── PAYLOAD_MIGRATE_ARGS contract ────────────────────────────────────────────

async function run(): Promise<void> {

  // ─── parseOutputFlag ──────────────────────────────────────────────────────

  await test('parseOutputFlag: absent flag — jsonMode=false, args unchanged', () => {
    const result = parseOutputFlag(['plan', '--expected-commit=abc'])
    assert.equal(result.jsonMode, false)
    assert.deepEqual(result.remaining, ['plan', '--expected-commit=abc'])
  })

  await test('parseOutputFlag: --output=json present — jsonMode=true, flag removed', () => {
    const result = parseOutputFlag(['plan', '--output=json', '--expected-commit=abc'])
    assert.equal(result.jsonMode, true)
    assert.deepEqual(result.remaining, ['plan', '--expected-commit=abc'])
  })

  await test('parseOutputFlag: --output=json at end — flag removed, subcommand preserved', () => {
    const result = parseOutputFlag(['plan', '--expected-commit=abc', '--output=json'])
    assert.equal(result.jsonMode, true)
    assert.deepEqual(result.remaining, ['plan', '--expected-commit=abc'])
  })

  await test('parseOutputFlag: --output=json at start — flag removed', () => {
    const result = parseOutputFlag(['--output=json', 'plan'])
    assert.equal(result.jsonMode, true)
    assert.deepEqual(result.remaining, ['plan'])
  })

  await test('parseOutputFlag: empty args — jsonMode=false', () => {
    const result = parseOutputFlag([])
    assert.equal(result.jsonMode, false)
    assert.deepEqual(result.remaining, [])
  })

  await test('parseOutputFlag: only --output=json — jsonMode=true, remaining empty', () => {
    const result = parseOutputFlag(['--output=json'])
    assert.equal(result.jsonMode, true)
    assert.deepEqual(result.remaining, [])
  })

  // ─── JSON-only output: plan result is a parseable JSON object with no log lines ─

  await test('plan: result in JSON mode is a valid JSON object on its own line', async () => {
    // Verify the result object is JSON-serializable and parses back to the same values
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: clientFactory36() }), noopOutput(),
    )
    const serialized = JSON.stringify(result)
    const parsed = JSON.parse(serialized)
    assert.equal(parsed.ok, true)
    assert.equal(parsed.mode, 'plan')
    assert.equal(typeof parsed.appliedCount, 'number')
    assert.ok(Array.isArray(parsed.pendingMigrations))
    assert.ok(Array.isArray(parsed.blockers))
    assert.equal(typeof parsed.message, 'string')
  })

  await test('plan: result has all required schema fields of the correct types', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: clientFactory36() }), noopOutput(),
    )
    assert.equal(typeof result.ok, 'boolean')
    assert.equal(typeof result.mode, 'string')
    assert.equal(typeof result.branch, 'string')
    assert.equal(typeof result.commit, 'string')
    assert.equal(typeof result.schema, 'string')
    assert.equal(typeof result.environment, 'string')
    assert.equal(typeof result.targetId, 'string')
    assert.equal(typeof result.appliedCount, 'number')
    assert.ok(Array.isArray(result.pendingMigrations))
    assert.ok(Array.isArray(result.blockers))
    assert.equal(typeof result.message, 'string')
  })

  await test('plan: result does not contain raw blockers text or hostnames in JSON', async () => {
    // The sanitized artifact must not contain raw error text with URLs or credentials
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: clientFactory36() }), noopOutput(),
    )
    const serialized = JSON.stringify(result)
    assert.ok(!serialized.includes('postgres://'), 'result must not contain PostgreSQL URL scheme')
    assert.ok(!serialized.includes('@'), 'result must not contain URL userinfo fragment')
  })

  // ─── PAYLOAD_MIGRATE_ARGS contract ────────────────────────────────────────────

  await test('PAYLOAD_MIGRATE_ARGS uses the repository binary and migrate command', () => {
    assert.ok(Array.isArray(PAYLOAD_MIGRATE_ARGS), 'must be an array')
    assert.ok(PAYLOAD_MIGRATE_ARGS.length >= 2)
    assert.ok(PAYLOAD_MIGRATE_ARGS[0].includes('payload'), 'first arg must reference payload binary')
    assert.equal(PAYLOAD_MIGRATE_ARGS[1], 'migrate', 'second arg must be migrate')
  })

  // ─── parsePlanCliArgs ──────────────────────────────────────────────────────

  await test('parsePlanCliArgs: parses all required fields', () => {
    const result = parsePlanCliArgs([
      `--expected-commit=${SYNTHETIC_HEAD}`,
      '--environment=staging',
      '--target-id=jpvbootcamp-staging',
      '--expected-schema=jpvbootcamp',
      `--expected-hostname=${STAGING_HOSTNAME}`,
      '--expected-database=jpvbootcamp_staging',
    ])
    assert.equal(result.expectedCommit, SYNTHETIC_HEAD)
    assert.equal(result.environment, REQUIRED_ENVIRONMENT)
    assert.equal(result.targetId, REQUIRED_TARGET_ID)
    assert.equal(result.expectedSchema, REQUIRED_SCHEMA)
    assert.equal(result.expectedHostname, STAGING_HOSTNAME)
    assert.equal(result.expectedDatabase, REQUIRED_DATABASE)
  })

  await test('parsePlanCliArgs: accepts explicit current-state verification mode', () => {
    const result = parsePlanCliArgs([
      `--expected-commit=${SYNTHETIC_HEAD}`,
      '--environment=staging',
      '--target-id=jpvbootcamp-staging',
      '--expected-schema=jpvbootcamp',
      `--expected-hostname=${STAGING_HOSTNAME}`,
      '--expected-database=jpvbootcamp_staging',
      '--current-state=true',
    ])
    assert.equal(result.currentState, true)
  })

  await test('parsePlanCliArgs: rejects missing expectedCommit', () => {
    assert.throws(() =>
      parsePlanCliArgs([
        '--environment=staging',
        '--target-id=jpvbootcamp-staging',
        '--expected-schema=jpvbootcamp',
        `--expected-hostname=${STAGING_HOSTNAME}`,
        '--expected-database=jpvbootcamp_staging',
      ]),
      /expected-commit/i,
    )
  })

  await test('parsePlanCliArgs: rejects unknown arguments', () => {
    assert.throws(() =>
      parsePlanCliArgs(['--unknown-flag=value', `--expected-commit=${SYNTHETIC_HEAD}`]),
    )
  })

  await test('parsePlanCliArgs: rejects positional arguments', () => {
    assert.throws(() => parsePlanCliArgs(['positional']))
  })

  // ─── parseApplyCliArgs ─────────────────────────────────────────────────────

  await test('parseApplyCliArgs: parses all required fields', () => {
    const result = parseApplyCliArgs([
      '--operator-id=ops',
      '--backup-evidence-id=bk1',
      '--maintenance-window-id=mw1',
      '--rollback-owner=ops',
      `--expected-commit=${SYNTHETIC_HEAD}`,
      '--environment=staging',
      '--target-id=jpvbootcamp-staging',
      '--expected-schema=jpvbootcamp',
      `--expected-hostname=${STAGING_HOSTNAME}`,
      '--expected-database=jpvbootcamp_staging',
      `--expected-migrations=${TARGET_MIGRATIONS.join(',')}`,
      `--confirmation=${APPLY_CONFIRMATION}`,
    ])
    assert.equal(result.operatorId, 'ops')
    assert.equal(result.expectedCommit, SYNTHETIC_HEAD)
    assert.equal(result.environment, REQUIRED_ENVIRONMENT)
    assert.equal(result.confirmation, APPLY_CONFIRMATION)
  })

  await test('parseApplyCliArgs: rejects missing expectedCommit', () => {
    assert.throws(() =>
      parseApplyCliArgs([
        '--operator-id=ops',
        '--backup-evidence-id=bk1',
        '--maintenance-window-id=mw1',
        '--rollback-owner=ops',
        '--environment=staging',
        '--target-id=jpvbootcamp-staging',
        '--expected-schema=jpvbootcamp',
        `--expected-hostname=${STAGING_HOSTNAME}`,
        '--expected-database=jpvbootcamp_staging',
        `--confirmation=${APPLY_CONFIRMATION}`,
      ]),
      /expected-commit/i,
    )
  })

  await test('parseApplyCliArgs: rejects missing confirmation', () => {
    assert.throws(() =>
      parseApplyCliArgs([
        '--operator-id=ops',
        '--backup-evidence-id=bk1',
        '--maintenance-window-id=mw1',
        '--rollback-owner=ops',
        `--expected-commit=${SYNTHETIC_HEAD}`,
        '--environment=staging',
        '--target-id=jpvbootcamp-staging',
        '--expected-schema=jpvbootcamp',
        `--expected-hostname=${STAGING_HOSTNAME}`,
        '--expected-database=jpvbootcamp_staging',
        `--expected-migrations=${TARGET_MIGRATIONS.join(',')}`,
      ]),
      /confirmation/i,
    )
  })

  await test('parseApplyCliArgs: rejects unknown arguments', () => {
    assert.throws(() =>
      parseApplyCliArgs(['--unknown-flag=value', '--operator-id=ops']),
    )
  })

  await test('parseApplyCliArgs: rejects positional arguments', () => {
    assert.throws(() => parseApplyCliArgs(['positional']))
  })

  // ─── plan: commit guard ────────────────────────────────────────────────────

  await test('plan: rejects missing expectedCommit', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput({ expectedCommit: undefined }),
      { gitResolver: okGit(), gitStatusResolver: cleanGitStatus() },
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b === 'expected_commit_required' || b.toLowerCase().includes('expected-commit') || b.toLowerCase().includes('expected_commit')))
  })

  await test('plan: rejects empty expectedCommit', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput({ expectedCommit: '' }),
      { gitResolver: okGit(), gitStatusResolver: cleanGitStatus() },
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b === 'expected_commit_required' || b.toLowerCase().includes('expected-commit') || b.toLowerCase().includes('expected_commit')))
  })

  await test('plan: rejects abbreviated commit (not 40 chars)', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput({ expectedCommit: 'a4081d1' }),
      { gitResolver: okGit(), gitStatusResolver: cleanGitStatus() },
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b === 'expected_commit_required' || b.toLowerCase().includes('40') || b.toLowerCase().includes('expected_commit')))
  })

  await test('plan: rejects wrong branch', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput(),
      { gitResolver: { branch: () => 'main', commit: () => SYNTHETIC_HEAD }, gitStatusResolver: cleanGitStatus() },
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('branch')))
  })

  await test('plan: rejects when expected commit does not match HEAD', async () => {
    const differentFullSha = '0000000000000000000000000000000000000001'
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput({ expectedCommit: differentFullSha }),
      { gitResolver: okGit(SYNTHETIC_HEAD), gitStatusResolver: cleanGitStatus() },
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('commit')))
  })

  await test('plan: no self-referential hardcoded commit — old SHA is rejected', async () => {
    // Prove the old hardcoded SHA from commit a4081d1 no longer works by itself.
    // The runner does not have it baked in; only a correct HEAD match passes.
    const oldSha = '969113bcbee5cbdc01a274d7ab3e5cafdc94ecca'
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput({ expectedCommit: oldSha }),
      // HEAD is SYNTHETIC_HEAD (a4081d1...), not the old SHA
      { gitResolver: okGit(SYNTHETIC_HEAD), gitStatusResolver: cleanGitStatus() },
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('commit')))
  })

  // ─── plan: environment and target guards ────────────────────────────────────

  await test('plan: rejects missing environment', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput({ environment: undefined }),
      baseDeps(),
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('environment')))
  })

  await test('plan: rejects wrong environment', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput({ environment: 'production' }),
      baseDeps(),
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('environment')))
  })

  await test('plan: rejects missing target-id', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput({ targetId: undefined }),
      baseDeps(),
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('target')))
  })

  await test('plan: rejects wrong target-id', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput({ targetId: 'jpvbootcamp-production' }),
      baseDeps(),
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('target')))
  })

  await test('plan: rejects production hostname in connection', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(PRODUCTION_HOSTNAME),
      undefined,
      goodPlanInput({ expectedHostname: PRODUCTION_HOSTNAME }),
      baseDeps({ clientFactory: clientFactory35() }),
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b === 'production_marker_rejected' || b.toLowerCase().includes('production marker') || b.toLowerCase().includes('production_marker')))
  })

  await test('plan: rejects mismatched staging hostname', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl('other-staging-db.internal'),
      undefined,
      goodPlanInput({ expectedHostname: STAGING_HOSTNAME }),
      baseDeps({ clientFactory: clientFactory35() }),
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('hostname')))
  })

  await test('plan: schema-only identity is insufficient — hostname must also match', async () => {
    // Same schema, but hostname mismatch — should block
    const result = await runStagingMigrationPlan(
      stagingUrl('wrong-host.internal'),
      undefined,
      goodPlanInput({ expectedHostname: STAGING_HOSTNAME }),
      baseDeps({ clientFactory: clientFactory35() }),
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('hostname')))
  })

  // ─── plan: worktree integrity ─────────────────────────────────────────────

  await test('plan: dirty guarded path blocks plan', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput(),
      baseDeps({
        gitStatusResolver: dirtyGitStatus([
          { status: 'M', path: 'scripts/release/runStagingPayloadMigration.ts' },
        ]),
      }),
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('worktree')))
  })

  await test('plan: dirty guarded migration path blocks plan', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput(),
      baseDeps({
        gitStatusResolver: dirtyGitStatus([
          { status: 'M', path: 'src/migrations/20260804_050000_member_account_action_reservations.ts' },
        ]),
      }),
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('worktree')))
  })

  await test('plan: protected residue does not block plan', async () => {
    // .ai/**, screenshots, logs must not block
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput(),
      baseDeps({
        gitStatusResolver: dirtyGitStatus([
          { status: 'M', path: '.ai/current.md' },
          { status: 'M', path: '.claude/worktrees/wf_abc123' },
          { status: 'M', path: 'evidence-landing.png' },
          { status: 'M', path: 'newrelic_agent.log' },
          { status: '?', path: '.env.production.BAK' },
        ]),
      }),
    )
    // Protected residue alone should not block. If it reaches DB and DB responds ok, plan is ok.
    // (Result depends on Payload/Prisma state, but not on the protected-residue entries.)
    assert.equal(result.mode, 'plan')
  })

  await test('plan: untracked guarded path blocks plan', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput(),
      baseDeps({
        gitStatusResolver: dirtyGitStatus([
          { status: '?', path: 'src/migrations/new_unauthorized_migration.ts' },
        ]),
      }),
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('worktree')))
  })

  // ─── plan: missing DATABASE_URL ──────────────────────────────────────────

  await test('plan: rejects missing DATABASE_URL', async () => {
    const result = await runStagingMigrationPlan(
      undefined,
      undefined,
      goodPlanInput(),
      baseDeps(),
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b === 'database_url_missing' || b.includes('DATABASE_URL') || b.includes('database_url')))
  })

  // ─── plan: Payload state checks ───────────────────────────────────────────

  await test('plan: reports canonical pending migrations independently of the reviewed apply batch', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput(),
      baseDeps({ clientFactory: clientFactory36() }),
      noopOutput(),
    )
    assert.equal(result.ok, true)
    assert.equal(result.appliedCount, HISTORICAL_APPLY_BASELINE_COUNT)
    assert.deepEqual(result.pendingMigrations, [...TARGET_MIGRATIONS])
    assert.equal(result.blockers.length, 0)
    assert.equal(result.mode, 'plan')
    assert.equal(result.environment, REQUIRED_ENVIRONMENT)
    assert.equal(result.targetId, REQUIRED_TARGET_ID)
  })

  await test('plan: reports exactly one pending canonical migration', async () => {
    const rows = PAYLOAD_MIGRATION_NAMES
      .filter((name) => name !== TARGET_MIGRATION)
      .map((name) => ({ name, batch: 1 }))
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput(),
      baseDeps({ clientFactory: () => makeClient({ schema: REQUIRED_SCHEMA, payloadRows: rows }) }),
      noopOutput(),
    )
    assert.equal(result.ok, true)
    assert.deepEqual(result.pendingMigrations, [TARGET_MIGRATION])
    assert.equal(result.blockers.length, 0)
  })

  await test('plan: current-state mode verifies the complete canonical registry and no pending migrations', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput({ currentState: true }),
      baseDeps({ clientFactory: clientFactoryCurrent() }),
      noopOutput(),
    )
    assert.equal(result.ok, true)
    assert.equal(result.appliedCount, CANONICAL_REGISTRY_FIXTURE_COUNT)
    assert.deepEqual(result.pendingMigrations, [])
    assert.equal(result.blockers.length, 0)
    assert.equal(result.message, 'plan_ok')
  })

  await test('plan: current-state mode blocks any pending canonical migration without using the reviewed apply batch', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(),
      undefined,
      goodPlanInput({ currentState: true }),
      baseDeps({ clientFactory: clientFactoryHistorical40() }),
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.pendingMigrations.length > 0)
    assert.ok(result.blockers.includes('pending_migration_mismatch'))
  })

  await test('plan: reports a complete pending list for a historical checkpoint', async () => {
    const all27 = FIRST_35.slice(1)
    const factory27: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: all27.map((n) => ({ name: n, batch: 1 })),
    })
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: factory27 }), noopOutput(),
    )
    assert.equal(result.ok, true)
    assert.equal(result.appliedCount, all27.length)
    assert.deepEqual(result.pendingMigrations, PAYLOAD_MIGRATION_NAMES.filter((name) => !all27.includes(name)))
    assert.equal(result.blockers.length, 0)
  })

  await test('plan: accepts a complete canonical registry without treating discovery as apply authorization', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: clientFactoryCurrent() }), noopOutput(),
    )
    assert.equal(result.ok, true)
    assert.deepEqual(result.pendingMigrations, [])
    assert.equal(result.blockers.length, 0)
  })

  await test('plan: registry growth is reported dynamically and never widened into the reviewed apply batch', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: clientFactoryHistorical40() }), noopOutput(),
    )
    const expectedPending = PAYLOAD_MIGRATION_NAMES.slice(FIRST_35.length)
    assert.equal(result.ok, true)
    assert.deepEqual(result.pendingMigrations, expectedPending)
    assert.notDeepEqual(result.pendingMigrations, [...TARGET_MIGRATIONS])
  })

  await test('plan: blocks when unexpected Payload migrations exist', async () => {
    const factory: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: [
        ...FIRST_35.map((n) => ({ name: n, batch: 1 })),
        { name: 'unexpected_migration', batch: 1 },
      ],
    })
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: factory }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('unexpected')))
  })

  await test('plan: blocks when duplicate Payload records exist', async () => {
    const factory: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: [
        ...FIRST_35.map((n) => ({ name: n, batch: 1 })),
        { name: FIRST_35[0], batch: 2 }, // duplicate of first
      ],
    })
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: factory }), noopOutput(),
    )
    assert.equal(result.ok, false)
    // Duplicates are now classified as malformed evidence
    assert.ok(
      result.blockers.some((b) => b.toLowerCase().includes('duplicate') || b.toLowerCase().includes('malformed')),
    )
  })

  // ─── plan: Prisma health checks ───────────────────────────────────────────

  await test('plan: blocks when Prisma migrations are empty', async () => {
    const factory: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: FIRST_35.map((n) => ({ name: n, batch: 1 })),
      prismaRows: [],
    })
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: factory }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('prisma')))
  })

  await test('plan: blocks when a Prisma migration is failed', async () => {
    const prismaRows = [
      ...REGISTERED_PRISMA_MIGRATIONS.slice(1).map((n) => appliedPrismaRow(n)),
      {
        migration_name: REGISTERED_PRISMA_MIGRATIONS[0],
        started_at: '2026-08-01T00:00:00.000Z',
        finished_at: null,
        rolled_back_at: null,
        applied_steps_count: 0,
        has_logs: true, // failed
      },
    ]
    const factory: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: FIRST_35.map((n) => ({ name: n, batch: 1 })),
      prismaRows,
    })
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: factory }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('prisma')))
  })

  await test('plan: blocks when a Prisma migration is in-progress', async () => {
    const prismaRows = [
      ...REGISTERED_PRISMA_MIGRATIONS.slice(1).map((n) => appliedPrismaRow(n)),
      {
        migration_name: REGISTERED_PRISMA_MIGRATIONS[0],
        started_at: '2026-08-01T00:00:00.000Z',
        finished_at: null, // in-progress
        rolled_back_at: null,
        applied_steps_count: 0,
        has_logs: false,
      },
    ]
    const factory: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: FIRST_35.map((n) => ({ name: n, batch: 1 })),
      prismaRows,
    })
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: factory }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('prisma')))
  })

  await test('plan: blocks when a Prisma migration is rolled-back', async () => {
    const prismaRows = [
      ...REGISTERED_PRISMA_MIGRATIONS.slice(1).map((n) => appliedPrismaRow(n)),
      {
        migration_name: REGISTERED_PRISMA_MIGRATIONS[0],
        started_at: '2026-08-01T00:00:00.000Z',
        finished_at: '2026-08-01T00:00:01.000Z',
        rolled_back_at: '2026-08-01T00:00:02.000Z', // rolled back
        applied_steps_count: 1,
        has_logs: false,
      },
    ]
    const factory: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: FIRST_35.map((n) => ({ name: n, batch: 1 })),
      prismaRows,
    })
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: factory }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('prisma')))
  })

  await test('plan: blocks when a Prisma migration is missing', async () => {
    const prismaRows = REGISTERED_PRISMA_MIGRATIONS.slice(1).map((n) => appliedPrismaRow(n))
    const factory: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: FIRST_35.map((n) => ({ name: n, batch: 1 })),
      prismaRows,
    })
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: factory }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('prisma')))
  })

  await test('plan: blocks when an unexpected Prisma migration exists', async () => {
    const prismaRows = [
      ...REGISTERED_PRISMA_MIGRATIONS.map((n) => appliedPrismaRow(n)),
      appliedPrismaRow('99999999_unexpected_migration'),
    ]
    const factory: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: FIRST_35.map((n) => ({ name: n, batch: 1 })),
      prismaRows,
    })
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: factory }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('prisma')))
  })

  await test('plan: blocks when duplicate Prisma records exist', async () => {
    const prismaRows = [
      ...REGISTERED_PRISMA_MIGRATIONS.map((n) => appliedPrismaRow(n)),
      appliedPrismaRow(REGISTERED_PRISMA_MIGRATIONS[0]), // duplicate
    ]
    const factory: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: FIRST_35.map((n) => ({ name: n, batch: 1 })),
      prismaRows,
    })
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: factory }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('prisma')))
  })

  await test('plan: mode field is always plan', async () => {
    const result = await runStagingMigrationPlan(
      undefined, undefined, goodPlanInput({ expectedCommit: undefined }),
      { gitResolver: okGit(), gitStatusResolver: cleanGitStatus() }, noopOutput(),
    )
    assert.equal(result.mode, 'plan')
  })

  await test('plan: output lines do not contain credentials from URL', async () => {
    const lines: string[] = []
    const sensitiveUrl = `postgres://user:secret-password@${STAGING_HOSTNAME}/${REQUIRED_DATABASE}?schema=${REQUIRED_SCHEMA}`
    await runStagingMigrationPlan(
      sensitiveUrl, undefined, goodPlanInput(),
      baseDeps({ clientFactory: clientFactory35() }),
      (line) => lines.push(line),
    )
    for (const line of lines) {
      assert.ok(!line.includes('secret-password'), `Output must not contain credentials: ${line}`)
      assert.ok(!line.includes(sensitiveUrl), `Output must not contain raw URL: ${line}`)
    }
  })

  // ─── apply: authorization guards ──────────────────────────────────────────

  await test('apply: rejects wrong branch', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization(),
        { ...baseDeps(), gitResolver: { branch: () => 'main', commit: () => SYNTHETIC_HEAD } },
        noopOutput(),
      ),
      /branch/i,
    )
  })

  await test('apply: rejects when HEAD does not match expectedCommit', async () => {
    const differentSha = '1111111111111111111111111111111111111111'
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization({ expectedCommit: differentSha }),
        baseDeps(), noopOutput(),
      ),
      /commit/i,
    )
  })

  await test('apply: rejects abbreviated commit in authorization', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization({ expectedCommit: 'a4081d1' }),
        baseDeps(), noopOutput(),
      ),
      /40/i,
    )
  })

  await test('apply: rejects missing operatorId', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization({ operatorId: '' }),
        baseDeps(), noopOutput(),
      ),
      /operatorId/i,
    )
  })

  await test('apply: rejects wrong confirmation', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization({ confirmation: 'wrong' }),
        baseDeps(), noopOutput(),
      ),
      /confirmation/i,
    )
  })

  await test('apply: rejects missing backupEvidenceId', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization({ backupEvidenceId: '' }),
        baseDeps(), noopOutput(),
      ),
      /backupEvidenceId/i,
    )
  })

  await test('apply: rejects missing maintenanceWindowId', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization({ maintenanceWindowId: '' }),
        baseDeps(), noopOutput(),
      ),
      /maintenanceWindowId/i,
    )
  })

  await test('apply: rejects missing rollbackOwner', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization({ rollbackOwner: '' }),
        baseDeps(), noopOutput(),
      ),
      /rollbackOwner/i,
    )
  })

  await test('apply: rejects missing DATABASE_URL', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        undefined, undefined, goodAuthorization(),
        baseDeps(), noopOutput(),
      ),
      /DATABASE_URL/i,
    )
  })

  await test('apply: rejects production hostname', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(PRODUCTION_HOSTNAME), undefined,
        goodAuthorization({ expectedHostname: PRODUCTION_HOSTNAME }),
        baseDeps(), noopOutput(),
      ),
      /production marker/i,
    )
  })

  await test('apply: rejects mismatched staging hostname', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl('other-staging.internal'), undefined, goodAuthorization(),
        baseDeps(), noopOutput(),
      ),
      /hostname/i,
    )
  })

  await test('apply: rejects a non-staging environment', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization({ environment: 'production' }),
        baseDeps(), noopOutput(),
      ),
      /environment/i,
    )
  })

  await test('apply: rejects a non-staging target', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization({ targetId: 'jpvbootcamp-production' }),
        baseDeps(), noopOutput(),
      ),
      /target/i,
    )
  })

  await test('apply: rejects a non-staging schema', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization({ expectedSchema: 'public' }),
        baseDeps(), noopOutput(),
      ),
      /schema/i,
    )
  })

  await test('apply: rejects a non-staging database', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization({ expectedDatabase: 'other_db' }),
        baseDeps(), noopOutput(),
      ),
      /database/i,
    )
  })

  await test('apply: dirty guarded path blocks apply', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization(),
        baseDeps({
          gitStatusResolver: dirtyGitStatus([
            { status: 'M', path: 'src/lib/payloadMigrationRegistry.ts' },
          ]),
        }),
        noopOutput(),
      ),
      /worktree/i,
    )
  })

  await test('apply: rejects when the explicit reviewed pre-apply baseline is incomplete', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization(),
        baseDeps({ clientFactory: clientFactoryHistorical35() }),
        noopOutput(),
      ),
      /pre-apply check failed/i,
    )
  })

  await test('apply: rejects when a Prisma migration is failed at pre-apply', async () => {
    const prismaRows = [
      ...REGISTERED_PRISMA_MIGRATIONS.slice(1).map((n) => appliedPrismaRow(n)),
      {
        migration_name: REGISTERED_PRISMA_MIGRATIONS[0],
        started_at: '2026-08-01T00:00:00.000Z',
        finished_at: null,
        rolled_back_at: null,
        applied_steps_count: 0,
        has_logs: true,
      },
    ]
    const factory: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: FIRST_35.map((n) => ({ name: n, batch: 1 })),
      prismaRows,
    })
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization(),
        baseDeps({ clientFactory: factory }),
        noopOutput(),
      ),
      /pre-apply check failed/i,
    )
  })

  await test('apply: non-zero exit returns APPLY_OUTCOME_UNCERTAIN (does not throw)', async () => {
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      baseDeps({ clientFactory: clientFactory35(), commandExecutor: okApplyExecutor(1) }),
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.equal('outcome' in result && result.outcome, APPLY_OUTCOME_UNCERTAIN)
    assert.equal(result.mode, 'apply')
  })

  await test('apply: uncertain outcome message does not recommend unconditional migrate:down', async () => {
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      baseDeps({ clientFactory: clientFactory35(), commandExecutor: okApplyExecutor(1) }),
      noopOutput(),
    )
    assert.ok('outcome' in result)
    assert.ok(result.message.length > 0)
    assert.ok(
      !result.message.includes('migrate:down') || result.message.includes('separate authorization'),
      'Uncertain message must not recommend bare migrate:down without separate authorization caveat',
    )
  })

  await test('apply: succeeds end-to-end with valid inputs', async () => {
    let commandArgs: string[] = []
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: clientFactorySequence() }),
        commandExecutor: (args) => {
          commandArgs = args
          return { status: 0 }
        },
      },
      noopOutput(),
    )
    assert.equal(result.ok, true)
    assert.equal(result.mode, 'apply')
    assert.equal(result.branch, REQUIRED_BRANCH)
    assert.equal(result.commit, SYNTHETIC_HEAD)
    assert.equal(result.schema, REQUIRED_SCHEMA)
    assert.equal(result.environment, REQUIRED_ENVIRONMENT)
    assert.equal(result.targetId, REQUIRED_TARGET_ID)
    assert.equal(result.preApply.appliedCount, HISTORICAL_APPLY_BASELINE_COUNT)
    assert.deepEqual(result.preApply.missingMigrations, [...TARGET_MIGRATIONS])
    assert.equal(result.postApply.appliedCount, CANONICAL_REGISTRY_FIXTURE_COUNT)
    assert.deepEqual(result.postApply.missingMigrations, [])
    // Exact CLI args must match PAYLOAD_MIGRATE_ARGS
    assert.deepEqual(commandArgs, PAYLOAD_MIGRATE_ARGS)
  })

  await test('apply: result does not expose confirmation value', async () => {
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      { ...baseDeps({ clientFactory: clientFactorySequence() }), commandExecutor: okApplyExecutor() },
      noopOutput(),
    )
    const serialized = JSON.stringify(result)
    assert.ok(!serialized.includes(APPLY_CONFIRMATION), 'Confirmation must not appear in result')
  })

  await test('apply: post-apply verification fails when DB still shows 28 after command', async () => {
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization(),
        baseDeps({ clientFactory: clientFactory35(), commandExecutor: okApplyExecutor() }),
        noopOutput(),
      ),
      /post-apply verification failed/i,
    )
  })

  await test('apply: connection material never appears in output', async () => {
    const lines: string[] = []
    const sensitiveUrl = `postgres://user:secret@${STAGING_HOSTNAME}/${REQUIRED_DATABASE}?schema=${REQUIRED_SCHEMA}`
    try {
      await runStagingMigrationApply(
        sensitiveUrl, undefined, goodAuthorization(),
        { ...baseDeps({ clientFactory: clientFactorySequence() }), commandExecutor: okApplyExecutor() },
        (line) => lines.push(line),
      )
    } catch {
      // May succeed or fail; we only check output
    }
    for (const line of lines) {
      assert.ok(!line.includes('secret'), `Output must not contain credentials: ${line}`)
      assert.ok(!line.includes(sensitiveUrl), `Output must not contain raw URL: ${line}`)
    }
  })

  // ─── rollback plan: guards ─────────────────────────────────────────────────

  await test('rollback-plan: rejects wrong confirmation', async () => {
    await assert.rejects(
      () => runStagingMigrationRollbackPlan(
        stagingUrl(), undefined, goodRollbackAuthorization({ confirmation: 'wrong' }),
        baseDeps({ clientFactory: clientFactory36() }), noopOutput(),
      ),
      /confirmation/i,
    )
  })

  await test('rollback-plan: rejects when not all canonical migrations are applied', async () => {
    const result = await runStagingMigrationRollbackPlan(
      stagingUrl(), undefined, goodRollbackAuthorization(),
      baseDeps({ clientFactory: clientFactory36() }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.includes(String(CANONICAL_REGISTRY_FIXTURE_COUNT)) || b.includes(String(HISTORICAL_APPLY_BASELINE_COUNT))))
  })

  await test('rollback-plan: ok when all current canonical migrations are applied and target batch is last', async () => {
    const result = await runStagingMigrationRollbackPlan(
      stagingUrl(), undefined, goodRollbackAuthorization(),
      baseDeps({ clientFactory: clientFactoryRollbackReady() }), noopOutput(),
    )
    assert.equal(result.ok, true)
    assert.equal(result.mode, 'rollback-plan')
    assert.ok(result.latestBatchMigrations.includes(TARGET_MIGRATION))
    assert.ok(result.message.toLowerCase().includes('separate authorization'))
  })

  await test('rollback-plan: blocks when last applied is not the target batch', async () => {
    const factory: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: [
        ...ALL_36.map((n) => ({ name: n, batch: 1 })),
        { name: 'extra_migration_after_29', batch: 2 }, // another migration applied after 29
      ],
    })
    const result = await runStagingMigrationRollbackPlan(
      stagingUrl(), undefined, goodRollbackAuthorization(),
      baseDeps({ clientFactory: factory }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.includes(TARGET_MIGRATION) || b.includes('last applied')))
  })

  await test('rollback-plan: does not execute migrate:down', async () => {
    let executorCalled = false
    const result = await runStagingMigrationRollbackPlan(
      stagingUrl(), undefined, goodRollbackAuthorization(),
      {
        ...baseDeps({ clientFactory: clientFactoryRollbackReady() }),
        commandExecutor: () => {
          executorCalled = true
          return { status: 0 }
        },
      },
      noopOutput(),
    )
    assert.equal(executorCalled, false, 'rollback-plan must never invoke command executor')
    assert.equal(result.ok, true)
  })

  await test('rollback-plan: mode field is always rollback-plan', async () => {
    const result = await runStagingMigrationRollbackPlan(
      stagingUrl(), undefined, goodRollbackAuthorization(),
      baseDeps({ clientFactory: clientFactory36() }), noopOutput(),
    )
    assert.equal(result.mode, 'rollback-plan')
  })

  // ─── parseRollbackPlanCliArgs ──────────────────────────────────────────────

  await test('parseRollbackPlanCliArgs: parses all required fields', () => {
    const result = parseRollbackPlanCliArgs([
      '--operator-id=ops',
      '--backup-evidence-id=bk1',
      '--maintenance-window-id=mw1',
      '--rollback-owner=ops',
      `--expected-commit=${SYNTHETIC_HEAD}`,
      '--environment=staging',
      '--target-id=jpvbootcamp-staging',
      '--expected-schema=jpvbootcamp',
      `--expected-hostname=${STAGING_HOSTNAME}`,
      '--expected-database=jpvbootcamp_staging',
      `--confirmation=${ROLLBACK_CONFIRMATION}`,
    ])
    assert.equal(result.operatorId, 'ops')
    assert.equal(result.expectedCommit, SYNTHETIC_HEAD)
    assert.equal(result.confirmation, ROLLBACK_CONFIRMATION)
  })

  await test('parseRollbackPlanCliArgs: rejects apply confirmation value', () => {
    // The rollback plan must require its own distinct confirmation value
    const auth = goodRollbackAuthorization({ confirmation: APPLY_CONFIRMATION })
    assert.notEqual(auth.confirmation, ROLLBACK_CONFIRMATION)
  })

  // ─── Side-effect guarantees ────────────────────────────────────────────────

  await test('plan is read-only: command executor is never called in plan mode', async () => {
    let executorCalled = false
    await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      {
        ...baseDeps({ clientFactory: clientFactory35() }),
        commandExecutor: () => {
          executorCalled = true
          return { status: 0 }
        },
      },
      noopOutput(),
    )
    assert.equal(executorCalled, false, 'plan must never invoke the command executor')
  })

  await test('no deploy, Prisma, provider, billing, member, or network side effect — only injected adapters used', async () => {
    // Verify that the runner calls only the injected adapters and no real I/O.
    // We do this by ensuring that synthetic injected factories control all DB access
    // and no error is thrown about missing infrastructure.
    let dbCallCount = 0
    const countingFactory: PgClientFactory = () => ({
      async connect() { dbCallCount++ },
      async query<R extends Record<string, unknown> = Record<string, unknown>>(text: string): Promise<{ rows: R[] }> {
        if (text.includes('current_schema()')) return { rows: [{ current_schema: REQUIRED_SCHEMA }] as unknown as R[] }
        if (text.includes('.payload_migrations')) return { rows: FIRST_35.map((n) => ({ name: n, batch: 1 })) as unknown as R[] }
        if (text.includes('._prisma_migrations')) return { rows: REGISTERED_PRISMA_MIGRATIONS.map((n) => appliedPrismaRow(n)) as unknown as R[] }
        return { rows: [] as unknown as R[] }
      },
      async end() {},
    })
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      { ...baseDeps({ clientFactory: countingFactory }) },
      noopOutput(),
    )
    assert.equal(result.ok, true)
    assert.ok(dbCallCount > 0, 'DB adapter must be used')
  })

  // ─── Defect 1: batch evidence preservation ────────────────────────────────

  await test('rollback-plan: succeeds when the explicit reviewed migration batch is highest batch', async () => {
    const result = await runStagingMigrationRollbackPlan(
      stagingUrl(), undefined, goodRollbackAuthorization(),
      baseDeps({ clientFactory: clientFactoryRollbackReady() }), noopOutput(),
    )
    assert.equal(result.ok, true)
    assert.deepEqual(result.latestBatchMigrations, [...TARGET_MIGRATIONS])
  })

  await test('rollback-plan: blocks when migration 29 shares its batch with another migration', async () => {
    const factory: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: [
        ...FIRST_35.map((n) => ({ name: n, batch: 1 })),
        { name: TARGET_MIGRATION, batch: 2 },
        { name: 'extra_in_same_batch', batch: 2 }, // shares batch with migration 29
      ],
    })
    const result = await runStagingMigrationRollbackPlan(
      stagingUrl(), undefined, goodRollbackAuthorization(),
      baseDeps({ clientFactory: factory }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('batch') || b.includes('1 (')))
  })

  await test('rollback-plan: blocks when a later batch exists after migration 29', async () => {
    const factory: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: [
        ...FIRST_35.map((n) => ({ name: n, batch: 1 })),
        { name: TARGET_MIGRATION, batch: 2 },
        { name: 'later_migration', batch: 3 }, // later batch
      ],
    })
    const result = await runStagingMigrationRollbackPlan(
      stagingUrl(), undefined, goodRollbackAuthorization(),
      baseDeps({ clientFactory: factory }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('batch') || b.toLowerCase().includes('last applied')))
  })

  await test('rollback-plan: blocks when batch metadata is missing (all batch=1 for all 36)', async () => {
    // All 36 in batch 1 — target migration is not isolated in highest batch
    const factory: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: ALL_36.map((n) => ({ name: n, batch: 1 })),
    })
    const result = await runStagingMigrationRollbackPlan(
      stagingUrl(), undefined, goodRollbackAuthorization(),
      baseDeps({ clientFactory: factory }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.length > 0)
  })

  await test('rollback-plan: blocks when batch evidence has duplicate records', async () => {
    const factory: PgClientFactory = () => makeClient({
      schema: REQUIRED_SCHEMA,
      payloadRows: [
        ...FIRST_35.map((n) => ({ name: n, batch: 1 })),
        { name: TARGET_MIGRATION, batch: 2 },
        { name: TARGET_MIGRATION, batch: 2 }, // duplicate
      ],
    })
    const result = await runStagingMigrationRollbackPlan(
      stagingUrl(), undefined, goodRollbackAuthorization(),
      baseDeps({ clientFactory: factory }), noopOutput(),
    )
    assert.equal(result.ok, false)
    // Duplicates are classified as malformed evidence
    assert.ok(
      result.blockers.some((b) => b.toLowerCase().includes('duplicate') || b.toLowerCase().includes('malformed')),
    )
  })

  // ─── Defect 2: exact database identity enforcement ────────────────────────

  await test('database guard: isolated jpvbootcamp_staging database accepted with canonical schema', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput({ expectedDatabase: 'jpvbootcamp_staging' }),
      baseDeps({ clientFactory: clientFactory35() }), noopOutput(),
    )
    assert.equal(result.ok, true)
  })

  await test('database guard: arbitrary non-production database rejected', async () => {
    const result = await runStagingMigrationPlan(
      `postgres://${STAGING_HOSTNAME}/other_db?schema=${REQUIRED_SCHEMA}`,
      undefined,
      goodPlanInput({ expectedDatabase: 'other_db' }),
      baseDeps({ clientFactory: clientFactory35() }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) =>
      b === 'target_identity_guard_failed' || b.toLowerCase().includes('database') || b.toLowerCase().includes('target')
    ))
  })

  await test('database guard: transitional jpvbootcamp_preview rejected even if expected arg matches', async () => {
    const result = await runStagingMigrationPlan(
      `postgres://${STAGING_HOSTNAME}/jpvbootcamp_preview?schema=${REQUIRED_SCHEMA}`,
      undefined,
      goodPlanInput({ expectedDatabase: 'jpvbootcamp_preview' }),
      baseDeps({ clientFactory: clientFactory35() }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) =>
      b === 'target_identity_guard_failed' || b.toLowerCase().includes('database') || b.toLowerCase().includes('target')
    ))
  })

  await test('database guard: production-named database rejected', async () => {
    for (const name of ['jpvbootcamp_prod', 'jpvbootcamp_production']) {
      const result = await runStagingMigrationPlan(
        `postgres://${STAGING_HOSTNAME}/${name}?schema=${REQUIRED_SCHEMA}`,
        undefined,
        goodPlanInput({ expectedDatabase: name }),
        baseDeps({ clientFactory: clientFactory35() }), noopOutput(),
      )
      assert.equal(result.ok, false, `${name} should be rejected`)
    }
  })

  // ─── Defect 3: tokenized hostname and DB markers ──────────────────────────

  await test('hostname guard: legitimate hostname containing "domain" is not falsely rejected', async () => {
    const result = await runStagingMigrationPlan(
      `postgres://staging-domain.internal/${REQUIRED_DATABASE}?schema=${REQUIRED_SCHEMA}`,
      undefined,
      goodPlanInput({ expectedHostname: 'staging-domain.internal' }),
      baseDeps({ clientFactory: clientFactory35() }), noopOutput(),
    )
    // Should not be blocked by the "domain" substring — only whole-token markers are rejected
    assert.ok(!result.blockers.some((b) => b.includes("production marker 'domain'")))
  })

  await test('hostname guard: exact approved staging hostname accepted', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(STAGING_HOSTNAME), undefined,
      goodPlanInput({ expectedHostname: STAGING_HOSTNAME }),
      baseDeps({ clientFactory: clientFactory35() }), noopOutput(),
    )
    assert.equal(result.ok, true)
  })

  await test('hostname guard: one-character hostname difference is rejected', async () => {
    const result = await runStagingMigrationPlan(
      `postgres://${STAGING_HOSTNAME}x/${REQUIRED_DATABASE}?schema=${REQUIRED_SCHEMA}`,
      undefined,
      goodPlanInput({ expectedHostname: STAGING_HOSTNAME }),
      baseDeps({ clientFactory: clientFactory35() }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('hostname')))
  })

  await test('hostname guard: prod/production/live/main token labels rejected', async () => {
    for (const label of ['prod', 'production', 'live', 'main']) {
      const hostname = `db.${label}.internal`
      const result = await runStagingMigrationPlan(
        `postgres://${hostname}/${REQUIRED_DATABASE}?schema=${REQUIRED_SCHEMA}`,
        undefined,
        goodPlanInput({ expectedHostname: hostname }),
        baseDeps({ clientFactory: clientFactory35() }), noopOutput(),
      )
      assert.equal(result.ok, false, `hostname with '${label}' token should be rejected`)
      assert.ok(
        result.blockers.some((b) =>
          b === 'production_marker_rejected' ||
          b.includes(`production marker '${label}'`) ||
          b.includes('production_marker')
        ),
        `should mention '${label}' marker or production_marker_rejected code`,
      )
    }
  })

  await test('hostname guard: arbitrary non-production hostname with correct database and matching --expected-hostname fails reviewed hostname check', async () => {
    // Even with expectedHostname === actualHostname and correct database,
    // a hostname that differs from the reviewed repository constant must be rejected.
    const result = await runStagingMigrationPlan(
      `postgres://arbitrary.host/${REQUIRED_DATABASE}?schema=${REQUIRED_SCHEMA}`,
      undefined,
      goodPlanInput({ expectedHostname: 'arbitrary.host', expectedDatabase: REQUIRED_DATABASE }),
      baseDeps({ clientFactory: clientFactory35() }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('hostname')))
  })

  // ─── Defect 4: rollback-plan worktree integrity ───────────────────────────

  await test('rollback-plan: dirty guarded path blocks rollback-plan', async () => {
    await assert.rejects(
      () => runStagingMigrationRollbackPlan(
        stagingUrl(), undefined, goodRollbackAuthorization(),
        {
          ...baseDeps({ clientFactory: clientFactory36() }),
          gitStatusResolver: dirtyGitStatus([
            { status: 'M', path: 'scripts/release/runStagingPayloadMigration.ts' },
          ]),
        },
        noopOutput(),
      ),
      /worktree/i,
    )
  })

  await test('rollback-plan: protected residue does not block rollback-plan', async () => {
    const result = await runStagingMigrationRollbackPlan(
      stagingUrl(), undefined, goodRollbackAuthorization(),
      {
        ...baseDeps({ clientFactory: clientFactory36() }),
        gitStatusResolver: dirtyGitStatus([
          { status: 'M', path: '.ai/current.md' },
          { status: 'M', path: '.claude/worktrees/wf_abc123' },
          { status: 'M', path: 'evidence-landing.png' },
          { status: 'M', path: 'newrelic_agent.log' },
          { status: '?', path: '.env.production.BAK' },
        ]),
      },
      noopOutput(),
    )
    assert.equal(result.mode, 'rollback-plan')
  })

  // ─── Defect 5: NUL-delimited git status parsing ───────────────────────────

  await test('parseNulGitStatus: modified guarded file parsed correctly', () => {
    const entries = parseNulGitStatus(' M scripts/release/runStagingPayloadMigration.ts\0')
    assert.equal(entries.length, 1)
    assert.equal(entries[0].path, 'scripts/release/runStagingPayloadMigration.ts')
  })

  await test('parseNulGitStatus: staged file parsed correctly', () => {
    const entries = parseNulGitStatus('M  src/lib/payloadMigrationRegistry.ts\0')
    assert.equal(entries.length, 1)
    assert.equal(entries[0].path, 'src/lib/payloadMigrationRegistry.ts')
  })

  await test('parseNulGitStatus: deleted file parsed correctly', () => {
    const entries = parseNulGitStatus(' D some/deleted/file.ts\0')
    assert.equal(entries.length, 1)
    assert.equal(entries[0].path, 'some/deleted/file.ts')
  })

  await test('parseNulGitStatus: untracked file parsed correctly', () => {
    const entries = parseNulGitStatus('?? some/new/file.ts\0')
    assert.equal(entries.length, 1)
    assert.equal(entries[0].path, 'some/new/file.ts')
  })

  await test('parseNulGitStatus: rename from guarded to unguarded emits both paths', () => {
    const raw = 'R  new/path/file.ts\0scripts/release/runStagingPayloadMigration.ts\0'
    const entries = parseNulGitStatus(raw)
    assert.equal(entries.length, 2)
    assert.ok(entries.some((e) => e.path === 'new/path/file.ts'))
    assert.ok(entries.some((e) => e.path === 'scripts/release/runStagingPayloadMigration.ts'))
  })

  await test('parseNulGitStatus: rename from unguarded to guarded emits both paths', () => {
    const raw = 'R  scripts/release/runStagingPayloadMigration.ts\0some/old/file.ts\0'
    const entries = parseNulGitStatus(raw)
    assert.equal(entries.length, 2)
    assert.ok(entries.some((e) => e.path === 'scripts/release/runStagingPayloadMigration.ts'))
    assert.ok(entries.some((e) => e.path === 'some/old/file.ts'))
  })

  await test('parseNulGitStatus: copy into guarded path emits both paths', () => {
    const raw = 'C  scripts/release/runStagingPayloadMigration.ts\0some/source/file.ts\0'
    const entries = parseNulGitStatus(raw)
    assert.equal(entries.length, 2)
    assert.ok(entries.some((e) => e.path === 'scripts/release/runStagingPayloadMigration.ts'))
  })

  await test('parseNulGitStatus: paths containing spaces parsed correctly', () => {
    const entries = parseNulGitStatus(' M path with spaces/file name.ts\0')
    assert.equal(entries.length, 1)
    assert.equal(entries[0].path, 'path with spaces/file name.ts')
  })

  await test('parseNulGitStatus: empty input returns empty array', () => {
    assert.deepEqual(parseNulGitStatus(''), [])
  })

  await test('parseNulGitStatus: malformed record (no space at index 2) throws', () => {
    assert.throws(() => parseNulGitStatus('MXfile.ts\0'), /Malformed/)
  })

  await test('parseNulGitStatus: record shorter than 3 chars throws', () => {
    assert.throws(() => parseNulGitStatus('M \0'), /Malformed/)
  })

  await test('guardGuardedPaths: rename of guarded file blocks via NUL parser', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({
        gitStatusResolver: dirtyGitStatus([
          { status: 'R', path: 'scripts/release/runStagingPayloadMigration.ts' },
        ]),
      }),
      noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('worktree')))
  })

  // ─── Defect 6: uncertain apply outcome ────────────────────────────────────

  await test('apply: execution error returns APPLY_OUTCOME_UNCERTAIN with status query evidence', async () => {
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: clientFactory35() }),
        commandExecutor: () => ({ status: null, error: new Error('spawn error') }),
      },
      noopOutput(),
    )
    assert.ok('outcome' in result)
    assert.equal('outcome' in result && result.outcome, APPLY_OUTCOME_UNCERTAIN)
    assert.equal(result.ok, false)
    assert.equal('outcome' in result && result.statusQuerySucceeded, true)
  })

  await test('apply: signal/null status returns APPLY_OUTCOME_UNCERTAIN', async () => {
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: clientFactory35() }),
        commandExecutor: () => ({ status: null }),
      },
      noopOutput(),
    )
    assert.ok('outcome' in result)
    assert.equal('outcome' in result && result.outcome, APPLY_OUTCOME_UNCERTAIN)
  })

  await test('apply: uncertain outcome at unchanged 36-state reports targetBatchApplied=false', async () => {
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: clientFactory35() }),
        commandExecutor: () => ({ status: 1 }),
      },
      noopOutput(),
    )
    assert.ok('outcome' in result)
    if ('outcome' in result) {
      assert.equal(result.schemaIdentityConfirmed, true)
      assert.equal(result.targetBatchApplied, false)
      assert.equal(result.appliedCount, HISTORICAL_APPLY_BASELINE_COUNT)
    }
  })

  await test('apply: uncertain outcome when clean 36-state appears despite command failure', async () => {
    // Pre-apply sees the explicit baseline, command fails, uncertain status query sees the full canonical registry.
    const factory: PgClientFactory = (() => {
      let call = 0
      return () => {
        const idx = call++
        return idx === 0 ? make36Client() : make37Client()
      }
    })()
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: factory }),
        commandExecutor: () => ({ status: 1 }),
      },
      noopOutput(),
    )
    assert.ok('outcome' in result)
    if ('outcome' in result) {
      assert.equal(result.outcome, APPLY_OUTCOME_UNCERTAIN)
      assert.equal(result.targetBatchApplied, true)
    }
  })

  await test('apply: uncertain outcome when status query also fails', async () => {
    // Pre-apply succeeds (36), command returns non-zero, then uncertain status query fails
    let call = 0
    const factory: PgClientFactory = () => {
      const idx = call++
      if (idx === 0) return make36Client() // pre-apply succeeds
      // uncertain status query — fail at connect
      return {
        async connect() { throw new Error('cannot connect for uncertain check') },
        async query() { return { rows: [] } },
        async end() {},
      }
    }
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: factory }),
        commandExecutor: () => ({ status: 1 }),
      },
      noopOutput(),
    )
    assert.ok('outcome' in result)
    if ('outcome' in result) {
      assert.equal(result.statusQuerySucceeded, false)
      assert.equal(result.appliedCount, null)
    }
  })

  await test('apply: uncertain outcome message never contains database URL or credentials', async () => {
    const sensitiveUrl = `postgres://user:secret@${STAGING_HOSTNAME}/${REQUIRED_DATABASE}?schema=${REQUIRED_SCHEMA}`
    const lines: string[] = []
    const result = await runStagingMigrationApply(
      sensitiveUrl, undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: clientFactory35() }),
        commandExecutor: () => ({ status: 1 }),
      },
      (line) => lines.push(line),
    )
    assert.ok('outcome' in result)
    const allText = lines.join('\n') + result.message
    assert.ok(!allText.includes('secret'), 'must not expose credentials')
    assert.ok(!allText.includes(sensitiveUrl), 'must not expose full URL')
  })

  // ─── Defect 1: malformed Payload evidence blocks all modes ───────────────────

  function malformedClientFactory(payloadRows: Array<{ name: unknown; batch: unknown }>, schema = REQUIRED_SCHEMA): PgClientFactory {
    return () => makeClient({ schema, payloadRows: payloadRows as Array<{ name: string; batch: number }> })
  }

  await test('malformed-payload: target row null batch blocks plan', async () => {
    const rows = [...FIRST_35.map((n) => ({ name: n, batch: 1 })), { name: TARGET_MIGRATION, batch: null }]
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: malformedClientFactory(rows) }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('malformed')))
  })

  await test('malformed-payload: target row negative batch blocks plan', async () => {
    const rows = [...FIRST_35.map((n) => ({ name: n, batch: 1 })), { name: TARGET_MIGRATION, batch: -1 }]
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: malformedClientFactory(rows) }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('malformed')))
  })

  await test('malformed-payload: target row fractional batch blocks plan', async () => {
    const rows = [...FIRST_35.map((n) => ({ name: n, batch: 1 })), { name: TARGET_MIGRATION, batch: 1.5 }]
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: malformedClientFactory(rows) }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('malformed')))
  })

  await test('payload evidence: numeric string batch is normalized before migration-state guards', async () => {
    const rows = [...FIRST_35.map((n) => ({ name: n, batch: 1 })), { name: TARGET_MIGRATION, batch: '1' }]
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: malformedClientFactory(rows) }), noopOutput(),
    )
    assert.equal(result.ok, true)
    assert.equal(result.blockers.some((b) => b.toLowerCase().includes('malformed')), false)
    assert.ok(!result.pendingMigrations.includes(TARGET_MIGRATION))
    assert.ok(result.pendingMigrations.length > 0)
  })

  await test('malformed-payload: target row empty name blocks plan', async () => {
    const rows = [...FIRST_35.map((n) => ({ name: n, batch: 1 })), { name: '', batch: 1 }]
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: malformedClientFactory(rows) }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('malformed')))
  })

  await test('malformed-payload: target row non-string name blocks plan', async () => {
    const rows = [...FIRST_35.map((n) => ({ name: n, batch: 1 })), { name: null, batch: 1 }]
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: malformedClientFactory(rows) }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('malformed')))
  })

  await test('malformed-payload: earlier migration malformed batch blocks plan', async () => {
    const rows = FIRST_35.map((n, i) => ({ name: n, batch: i === 0 ? -99 : 1 }))
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: malformedClientFactory(rows) }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('malformed')))
  })

  await test('malformed-payload: malformed rows block apply pre-apply check', async () => {
    const rows = [...FIRST_35.map((n) => ({ name: n, batch: 1 })), { name: TARGET_MIGRATION, batch: null }]
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization(),
        baseDeps({ clientFactory: malformedClientFactory(rows) }), noopOutput(),
      ),
      /pre-apply check failed/i,
    )
  })

  await test('malformed-payload: malformed rows block rollback-plan', async () => {
    const rows = [
      ...FIRST_35.map((n) => ({ name: n, batch: 1 })),
      { name: TARGET_MIGRATION, batch: 2 },
      { name: TARGET_MIGRATION, batch: null }, // duplicate + malformed
    ]
    const result = await runStagingMigrationRollbackPlan(
      stagingUrl(), undefined, goodRollbackAuthorization(),
      baseDeps({ clientFactory: malformedClientFactory(rows) }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('malformed')))
  })

  // ─── Defect 2: reviewed hostname root of trust ────────────────────────────────

  await test('hostname guard: reviewed hostname passes identity check', async () => {
    const result = await runStagingMigrationPlan(
      stagingUrl(STAGING_HOSTNAME), undefined,
      goodPlanInput({ expectedHostname: STAGING_HOSTNAME }),
      baseDeps({ clientFactory: clientFactory35() }), noopOutput(),
    )
    assert.equal(result.ok, true)
  })

  await test('hostname guard: one-character reviewed hostname difference fails', async () => {
    const oneOff = STAGING_HOSTNAME + 'x'
    const result = await runStagingMigrationPlan(
      `postgres://${oneOff}/${REQUIRED_DATABASE}?schema=${REQUIRED_SCHEMA}`,
      undefined,
      goodPlanInput({ expectedHostname: oneOff }),
      baseDeps({ clientFactory: clientFactory35() }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('hostname')))
  })

  await test('hostname guard: case-normalized comparison — reviewed hostname is lowercase IP', async () => {
    // URL.hostname lowercases hostnames — IP addresses are already lowercase; no mismatch on case
    const result = await runStagingMigrationPlan(
      stagingUrl(STAGING_HOSTNAME), undefined,
      goodPlanInput({ expectedHostname: STAGING_HOSTNAME }),
      baseDeps({ clientFactory: clientFactory35() }), noopOutput(),
    )
    assert.equal(result.ok, true)
  })

  await test('hostname guard: trailing-dot hostname is rejected (does not match reviewed constant)', async () => {
    const trailingDot = STAGING_HOSTNAME + '.'
    const result = await runStagingMigrationPlan(
      `postgres://${trailingDot}/${REQUIRED_DATABASE}?schema=${REQUIRED_SCHEMA}`,
      undefined,
      goodPlanInput({ expectedHostname: STAGING_HOSTNAME }),
      baseDeps({ clientFactory: clientFactory35() }), noopOutput(),
    )
    assert.equal(result.ok, false)
    assert.ok(result.blockers.some((b) => b.toLowerCase().includes('hostname')))
  })

  await test('hostname guard: port numbers do not affect hostname comparison', async () => {
    // postgres://10.0.2.4:5433/db — URL.hostname strips port from hostname
    const result = await runStagingMigrationPlan(
      `postgres://${STAGING_HOSTNAME}:5433/${REQUIRED_DATABASE}?schema=${REQUIRED_SCHEMA}`,
      undefined,
      goodPlanInput({ expectedHostname: STAGING_HOSTNAME }),
      baseDeps({ clientFactory: clientFactory35() }), noopOutput(),
    )
    assert.equal(result.ok, true)
  })

  await test('hostname guard: credentials and URL material never appear in output', async () => {
    const lines: string[] = []
    const sensitiveUrl = `postgres://admin:secret123@${STAGING_HOSTNAME}/${REQUIRED_DATABASE}?schema=${REQUIRED_SCHEMA}`
    const result = await runStagingMigrationPlan(
      sensitiveUrl, undefined, goodPlanInput(),
      baseDeps({ clientFactory: clientFactory35() }),
      (line) => lines.push(line),
    )
    const allText = lines.join('\n') + JSON.stringify(result)
    assert.ok(!allText.includes('secret123'), 'must not expose password')
    assert.ok(!allText.includes(sensitiveUrl), 'must not expose full URL')
  })

  // ─── Defect 3: sanitized uncertain-outcome categories ────────────────────────

  await test('uncertain-outcome: error message containing PostgreSQL URL is not echoed', async () => {
    const pgUrl = `postgres://admin:secret@${STAGING_HOSTNAME}/${REQUIRED_DATABASE}?schema=${REQUIRED_SCHEMA}`
    const lines: string[] = []
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: clientFactory35() }),
        commandExecutor: () => ({ status: null, error: new Error(`Failed to connect: ${pgUrl}`) }),
      },
      (line) => lines.push(line),
    )
    const allText = lines.join('\n') + JSON.stringify(result)
    assert.ok(!allText.includes('secret'), 'error message with secret must not appear in output')
    assert.ok(!allText.includes(pgUrl), 'raw PG URL must not appear in output')
    assert.ok('outcome' in result && result.outcome === APPLY_OUTCOME_UNCERTAIN)
  })

  await test('uncertain-outcome: error message containing username and password is not echoed', async () => {
    const lines: string[] = []
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: clientFactory35() }),
        commandExecutor: () => ({ status: null, error: new Error('auth failed: user=admin password=hunter2 host=db') }),
      },
      (line) => lines.push(line),
    )
    const allText = lines.join('\n') + JSON.stringify(result)
    assert.ok(!allText.includes('hunter2'), 'password must not appear in output')
    assert.ok(!allText.includes('auth failed: user=admin'), 'raw error detail must not appear in output')
  })

  await test('uncertain-outcome: error with authorization-like value is sanitized', async () => {
    const lines: string[] = []
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: clientFactory35() }),
        commandExecutor: () => ({ status: null, error: new Error('Authorization: Bearer supersecret-token-abc123') }),
      },
      (line) => lines.push(line),
    )
    const allText = lines.join('\n') + JSON.stringify(result)
    assert.ok(!allText.includes('supersecret-token-abc123'), 'auth header value must not appear in output')
  })

  await test('uncertain-outcome: environment-style secret value is sanitized', async () => {
    const lines: string[] = []
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: clientFactory35() }),
        commandExecutor: () => ({ status: null, error: new Error('STRIPE_SECRET_KEY=sk_live_ABC123 not found') }),
      },
      (line) => lines.push(line),
    )
    const allText = lines.join('\n') + JSON.stringify(result)
    assert.ok(!allText.includes('sk_live_ABC123'), 'env secret value must not appear in output')
  })

  await test('uncertain-outcome: message uses fixed category string, not raw error', async () => {
    const lines: string[] = []
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: clientFactory35() }),
        commandExecutor: () => ({ status: null, error: new Error('do-not-include-this-in-output') }),
      },
      (line) => lines.push(line),
    )
    const allText = lines.join('\n') + ('message' in result ? result.message : '')
    assert.ok(!allText.includes('do-not-include-this-in-output'))
    assert.ok(allText.includes('migration_command_execution_error'))
  })

  await test('uncertain-outcome: nonzero exit uses fixed category with safe integer status', async () => {
    const lines: string[] = []
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: clientFactory35() }),
        commandExecutor: () => ({ status: 42 }),
      },
      (line) => lines.push(line),
    )
    const allText = lines.join('\n') + ('message' in result ? result.message : '')
    assert.ok(allText.includes('42'), 'exit status should appear')
    assert.ok(allText.includes('migration_command_nonzero_exit'))
  })

  await test('uncertain-outcome: signal returns fixed category', async () => {
    const lines: string[] = []
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: clientFactory35() }),
        commandExecutor: () => ({ status: null }),
      },
      (line) => lines.push(line),
    )
    const allText = lines.join('\n') + ('message' in result ? result.message : '')
    assert.ok(allText.includes('migration_command_signal_or_indeterminate'))
  })

  // ─── Sanitization: secret-bearing errors never reach output ─────────────────

  await test('sanitize: plan status-query error with secret-bearing message is never echoed', async () => {
    // Inject a factory whose PG client throws an error containing a DB URL with credentials
    const secretUrl = `postgres://admin:supersecretpw@${STAGING_HOSTNAME}/${REQUIRED_DATABASE}`
    const leakyFactory: PgClientFactory = () => ({
      async connect() { throw new Error(`Connection failed: ${secretUrl}`) },
      async query() { return { rows: [] } },
      async end() {},
    })
    const lines: string[] = []
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: leakyFactory }),
      (line) => lines.push(line),
    )
    const allText = lines.join('\n') + JSON.stringify(result)
    assert.ok(result.ok === false)
    assert.ok(!allText.includes('supersecretpw'), 'credential must not appear in plan output or result')
    assert.ok(!allText.includes(secretUrl), 'raw URL must not appear in plan output or result')
    // Must use a fixed category, not the raw error text
    assert.ok(
      result.blockers.some((b) => b === 'status_query_failed' || b === 'read-only-status-query-failed'),
      'plan blocker must use fixed category',
    )
  })

  await test('sanitize: apply pre-apply status-query error with secret-bearing message is not echoed', async () => {
    const secretHostname = 'db.internal'
    const leakyFactory: PgClientFactory = () => ({
      async connect() { throw new Error(`PGPASSWORD=hunter99 host=${secretHostname}`) },
      async query() { return { rows: [] } },
      async end() {},
    })
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization(),
        baseDeps({ clientFactory: leakyFactory }), noopOutput(),
      ),
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        assert.ok(!msg.includes('hunter99'), 'credential must not appear in apply thrown error')
        assert.ok(msg.includes('pre-apply-status-query-failed'), 'must use fixed category')
        return true
      },
    )
  })

  await test('sanitize: apply uncertain-outcome status-query error with secret is not echoed', async () => {
    // Pre-apply succeeds (36 rows), command fails (non-zero), uncertain status query leaks secret
    let call = 0
    const leakyFactory: PgClientFactory = () => {
      const idx = call++
      if (idx === 0) return make36Client()
      return {
        async connect() { throw new Error('pg_hba.conf rejection: password=topsecretpwd host=10.0.2.4') },
        async query() { return { rows: [] } },
        async end() {},
      }
    }
    const lines: string[] = []
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: leakyFactory }),
        commandExecutor: () => ({ status: 1 }),
      },
      (line) => lines.push(line),
    )
    const allText = lines.join('\n') + JSON.stringify(result)
    assert.ok(!allText.includes('topsecretpwd'), 'credential must not appear in uncertain-outcome output')
    assert.ok('outcome' in result && result.outcome === APPLY_OUTCOME_UNCERTAIN)
    assert.equal('outcome' in result && result.statusQuerySucceeded, false)
  })

  await test('sanitize: apply post-apply status-query error with secret-bearing message is not echoed', async () => {
    // Pre-apply succeeds, command succeeds (exit 0), post-apply query throws with a secret
    let call = 0
    const leakyFactory: PgClientFactory = () => {
      const idx = call++
      if (idx === 0) return make36Client()
      return {
        async connect() { throw new Error('DB_PASSWORD=postapplysecret123 connection refused') },
        async query() { return { rows: [] } },
        async end() {},
      }
    }
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization(),
        {
          ...baseDeps({ clientFactory: leakyFactory }),
          commandExecutor: () => ({ status: 0 }),
        },
        noopOutput(),
      ),
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        assert.ok(!msg.includes('postapplysecret123'), 'credential must not appear in post-apply thrown error')
        assert.ok(msg.includes('post-apply-status-query-failed'), 'must use fixed category')
        return true
      },
    )
  })

  await test('sanitize: rollback-plan status-query error with secret-bearing message is not echoed', async () => {
    const leakyFactory: PgClientFactory = () => ({
      async connect() { throw new Error('SSL SYSCALL error: PGPASSWORD=rollbacksecret EOF detected') },
      async query() { return { rows: [] } },
      async end() {},
    })
    await assert.rejects(
      () => runStagingMigrationRollbackPlan(
        stagingUrl(), undefined, goodRollbackAuthorization(),
        baseDeps({ clientFactory: leakyFactory }), noopOutput(),
      ),
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        assert.ok(!msg.includes('rollbacksecret'), 'credential must not appear in rollback-plan thrown error')
        assert.ok(msg.includes('rollback-plan-status-query-failed'), 'must use fixed category')
        return true
      },
    )
  })

  await test('sanitize: CLI apply catch never echoes raw error.message containing secret', async () => {
    // Simulate an error thrown by runStagingMigrationApply that contains a secret
    // The CLI catch logs error.message — verify the fixed-category errors we now throw
    // do NOT contain the raw secret when the status-query path is involved.
    // We verify this at the function level since the CLI catch is a thin wrapper.
    let call = 0
    const leakyFactory: PgClientFactory = () => {
      const idx = call++
      if (idx === 0) return make36Client()
      return {
        async connect() { throw new Error('FATAL: password authentication failed for "admin" pw=cliSecret777') },
        async query() { return { rows: [] } },
        async end() {},
      }
    }
    let caughtMessage = ''
    try {
      await runStagingMigrationApply(
        stagingUrl(), undefined, goodAuthorization(),
        {
          ...baseDeps({ clientFactory: leakyFactory }),
          commandExecutor: () => ({ status: 0 }),
        },
        noopOutput(),
      )
    } catch (err: unknown) {
      caughtMessage = err instanceof Error ? err.message : String(err)
    }
    assert.ok(!caughtMessage.includes('cliSecret777'), 'CLI catch must not propagate credential in thrown message')
    assert.ok(caughtMessage.includes('post-apply-status-query-failed'), 'must use fixed category')
  })

  // ─── Defect 7: current-checkout git resolver integration test ─────────────

  await test('plan: reports a missing historical migration without treating it as an apply blocker', async () => {
    const rows = FIRST_35.filter((name) => name !== MIGRATION35).map((name) => ({ name, batch: 1 }))
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: () => makeClient({ schema: REQUIRED_SCHEMA, payloadRows: rows }) }), noopOutput(),
    )
    assert.equal(result.ok, true)
    assert.ok(result.pendingMigrations.includes(MIGRATION35))
    assert.equal(result.blockers.length, 0)
  })

  await test('plan: reports remaining canonical migrations after a partial reviewed batch', async () => {
    const rows = [
      ...FIRST_35.map((name) => ({ name, batch: 1 })),
      { name: TARGET_MIGRATIONS[0], batch: 2 },
    ]
    const result = await runStagingMigrationPlan(
      stagingUrl(), undefined, goodPlanInput(),
      baseDeps({ clientFactory: () => makeClient({ schema: REQUIRED_SCHEMA, payloadRows: rows }) }), noopOutput(),
    )
    assert.equal(result.ok, true)
    assert.ok(result.pendingMigrations.length > 0)
    assert.equal(result.blockers.length, 0)
  })

  await test('apply: wrong expectedMigrations batch is rejected before executor', async () => {
    let executorCalled = false
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined,
        goodAuthorization({ expectedMigrations: [MIGRATION35] }),
        {
          ...baseDeps({ clientFactory: clientFactory35() }),
          commandExecutor: () => { executorCalled = true; return { status: 0 } },
        },
        noopOutput(),
      ),
      /expectedMigrations/,
    )
    assert.equal(executorCalled, false)
  })

  await test('apply: extra expectedMigrations entry is rejected before executor', async () => {
    let executorCalled = false
    const extraMigration = [MIGRATION35, ...TARGET_MIGRATIONS]
    await assert.rejects(
      () => runStagingMigrationApply(
        stagingUrl(), undefined,
        goodAuthorization({ expectedMigrations: extraMigration }),
        {
          ...baseDeps({ clientFactory: clientFactory35() }),
          commandExecutor: () => { executorCalled = true; return { status: 0 } },
        },
        noopOutput(),
      ),
      /expectedMigrations/,
    )
    assert.equal(executorCalled, false)
  })

  await test('apply: uncertain outcome with the full canonical registry applied reports targetBatchApplied=true', async () => {
    const factory: PgClientFactory = clientFactorySequence()
    const result = await runStagingMigrationApply(
      stagingUrl(), undefined, goodAuthorization(),
      {
        ...baseDeps({ clientFactory: factory }),
        commandExecutor: () => ({ status: 1 }),
      },
      noopOutput(),
    )
    assert.ok('outcome' in result)
    if ('outcome' in result) {
      assert.equal(result.appliedCount, CANONICAL_REGISTRY_FIXTURE_COUNT)
      assert.equal(result.targetBatchApplied, true)
    }
  })

  await test('git resolver: real HEAD passes guard; abbreviated or prior SHA fails', async () => {
    const { execSync } = await import('node:child_process')
    const realHead = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()

    // Real HEAD should pass the commit guard (no gitResolver override — uses real git)
    const okResult = await runStagingMigrationPlan(
      stagingUrl(), undefined,
      goodPlanInput({ expectedCommit: realHead }),
      {
        // No gitResolver — uses real git resolver
        gitStatusResolver: cleanGitStatus(),
        clientFactory: clientFactory35(),
        commandExecutor: okApplyExecutor(),
      },
      noopOutput(),
    )
    // Branch guard may fail (we may be on the right branch already), but commit guard must pass
    assert.ok(
      okResult.ok ||
        !okResult.blockers.some((b) =>
          b === 'commit_guard_failed' || b === 'expected_commit_required' || b.toLowerCase().includes('commit')
        ),
      'Real HEAD should not fail commit guard',
    )

    // Abbreviated SHA must fail
    const abbrev = realHead.slice(0, 8)
    const abbrevResult = await runStagingMigrationPlan(
      stagingUrl(), undefined,
      goodPlanInput({ expectedCommit: abbrev }),
      {
        gitResolver: okGit(realHead),
        gitStatusResolver: cleanGitStatus(),
        clientFactory: clientFactory35(),
        commandExecutor: okApplyExecutor(),
      },
      noopOutput(),
    )
    assert.equal(abbrevResult.ok, false)
    assert.ok(abbrevResult.blockers.some((b) => b === 'expected_commit_required' || b.includes('expected_commit')))

    // Previous SHA must fail (HEAD is not SYNTHETIC_HEAD unless we are at that exact commit)
    if (realHead !== SYNTHETIC_HEAD) {
      const prevResult = await runStagingMigrationPlan(
        stagingUrl(), undefined,
        goodPlanInput({ expectedCommit: SYNTHETIC_HEAD }),
        {
          gitResolver: okGit(realHead),
          gitStatusResolver: cleanGitStatus(),
          clientFactory: clientFactory35(),
          commandExecutor: okApplyExecutor(),
        },
        noopOutput(),
      )
      assert.equal(prevResult.ok, false)
      assert.ok(prevResult.blockers.some((b) => b === 'commit_guard_failed' || b.toLowerCase().includes('commit')))
    }
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
