import assert from 'node:assert/strict'

import { PAYLOAD_MIGRATION_NAMES } from '../../src/lib/payloadMigrationRegistry'
import {
  ROOMS_STAGING_CONFIRMATION,
  ROOMS_STAGING_MIGRATION,
  runRoomsStagingMigrationApply,
  parseRoomsStagingMigrationArgs,
  type RoomsStagingMigrationAuthorization,
  type RoomsStagingMigrationDependencies,
} from './runRoomsStagingPayloadMigration'
import {
  REGISTERED_PRISMA_MIGRATIONS,
  type PgClientLike,
} from './buildStagingMigrationStatus'

const EXPECTED_COMMIT = 'a4081d12c7141ed8f5476077536c5234a555f240'
const DATABASE_URL = 'postgresql://user:secret@10.0.2.4:5433/jpvbootcamp_staging?schema=jpvbootcamp'
const FIRST_52 = PAYLOAD_MIGRATION_NAMES.slice(0, -1)
const CURRENT_53 = [...PAYLOAD_MIGRATION_NAMES]

function prismaRows() {
  return REGISTERED_PRISMA_MIGRATIONS.map((migration_name) => ({
    migration_name,
    started_at: '2026-08-30T00:00:00.000Z',
    finished_at: '2026-08-30T00:00:01.000Z',
    rolled_back_at: null,
    applied_steps_count: 1,
    has_logs: false,
  }))
}

function client(payloadNames: string[]): PgClientLike {
  return {
    async connect() {},
    async query(text: string) {
      if (text.includes('current_schema()')) return { rows: [{ current_schema: 'jpvbootcamp' }] }
      if (text.includes('.payload_migrations')) return { rows: payloadNames.map((name) => ({ name, batch: 1 })) }
      if (text.includes('._prisma_migrations')) return { rows: prismaRows() }
      return { rows: [] }
    },
    async end() {},
  }
}

function authorization(overrides: Partial<RoomsStagingMigrationAuthorization> = {}): RoomsStagingMigrationAuthorization {
  return {
    operatorId: 'operator-1',
    backupEvidenceId: 'backup-1',
    maintenanceWindowId: 'maintenance-1',
    rollbackOwner: 'rollback-owner-1',
    expectedCommit: EXPECTED_COMMIT,
    sourceTip: EXPECTED_COMMIT,
    environment: 'staging',
    targetId: 'jpvbootcamp-staging',
    expectedSchema: 'jpvbootcamp',
    expectedHostname: '10.0.2.4',
    expectedDatabase: 'jpvbootcamp_staging',
    expectedPort: '5433',
    confirmation: ROOMS_STAGING_CONFIRMATION,
    migrationApproval: 'approved',
    rollbackReadiness: 'ready',
    ...overrides,
  }
}

function dependencies(
  payloadStates: string[][],
  commandStatus = 0,
  commandCalled: { value: boolean } = { value: false },
): RoomsStagingMigrationDependencies {
  let index = 0
  return {
    gitResolver: {
      branch: () => 'feature/member-portal-rooms',
      commit: () => EXPECTED_COMMIT,
    },
    gitStatusResolver: () => '',
    clientFactory: () => client(payloadStates[Math.min(index++, payloadStates.length - 1)]),
    commandExecutor: () => {
      commandCalled.value = true
      return { status: commandStatus }
    },
  }
}

async function main(): Promise<void> {
  const parsed = parseRoomsStagingMigrationArgs([
    '--operator-id=operator-1', '--backup-evidence-id=backup-1', '--maintenance-window-id=maintenance-1',
    '--rollback-owner=rollback-owner-1', `--expected-commit=${EXPECTED_COMMIT}`, `--source-tip=${EXPECTED_COMMIT}`, '--environment=staging',
    '--target-id=jpvbootcamp-staging', '--expected-schema=jpvbootcamp', '--expected-hostname=10.0.2.4',
    '--expected-database=jpvbootcamp_staging', '--expected-port=5433',
    `--confirmation=${ROOMS_STAGING_CONFIRMATION}`, '--migration-approval=approved', '--rollback-readiness=ready',
  ])
  assert.equal(parsed.expectedCommit, EXPECTED_COMMIT)
  assert.equal(parsed.confirmation, ROOMS_STAGING_CONFIRMATION)

  const preMismatchCalled = { value: false }
  const preMismatch = await runRoomsStagingMigrationApply(
    DATABASE_URL, 'jpvbootcamp', authorization(), dependencies([FIRST_52.slice(0, -1)], 0, preMismatchCalled),
  )
  assert.equal(preMismatch.ok, false)
  assert.ok(preMismatch.blockers.includes('applied_count_mismatch'))
  assert.equal(preMismatchCalled.value, false)

  const applied = await runRoomsStagingMigrationApply(
    DATABASE_URL, 'jpvbootcamp', authorization(), dependencies([FIRST_52, CURRENT_53]),
  )
  assert.equal(applied.ok, true)
  assert.equal(applied.resultCode, 'applied')
  assert.equal(applied.preApply?.missingPayloadMigrations[0], ROOMS_STAGING_MIGRATION)
  assert.deepEqual(applied.postApply?.missingPayloadMigrations, [])

  const uncertain = await runRoomsStagingMigrationApply(
    DATABASE_URL, 'jpvbootcamp', authorization(), dependencies([FIRST_52, CURRENT_53], 1),
  )
  assert.equal(uncertain.ok, false)
  assert.equal(uncertain.resultCode, 'uncertain')
  assert.equal(uncertain.targetMigrationApplied, true)

  const commandArgs: string[][] = []
  const commandAudit = await runRoomsStagingMigrationApply(
    DATABASE_URL,
    'jpvbootcamp',
    authorization(),
    {
      ...dependencies([FIRST_52, CURRENT_53]),
      commandExecutor: (args) => {
        commandArgs.push(args)
        return { status: 0 }
      },
    },
  )
  assert.equal(commandAudit.ok, true)
  assert.deepEqual(commandArgs, [['./node_modules/.bin/payload', 'migrate']])

  await assert.rejects(
    () => runRoomsStagingMigrationApply(
      DATABASE_URL, 'jpvbootcamp', authorization({ backupEvidenceId: 'https://example.test/evidence' }),
      dependencies([FIRST_52]),
    ),
    /authorization_backup_evidence_invalid/,
  )

  await assert.rejects(
    () => runRoomsStagingMigrationApply(
      DATABASE_URL,
      'jpvbootcamp',
      authorization({ sourceTip: 'b'.repeat(40) }),
      {
        ...dependencies([FIRST_52]),
        candidateAncestorResolver: () => false,
        gitResolver: {
          branch: () => 'feature/member-portal-rooms',
          commit: () => 'b'.repeat(40),
        },
      },
    ),
    /candidate_not_in_approved_source/,
  )

  await assert.rejects(
    () => runRoomsStagingMigrationApply(
      'postgresql://user:secret@prod-db.internal:5433/jpvbootcamp_production?schema=jpvbootcamp',
      'jpvbootcamp', authorization(),
      dependencies([FIRST_52]),
    ),
    /production_target_rejected/,
  )

  await assert.rejects(
    () => runRoomsStagingMigrationApply(
      DATABASE_URL, 'jpvbootcamp', authorization({ rollbackReadiness: 'pending' }), dependencies([FIRST_52]),
    ),
    /rollback_readiness_not_confirmed/,
  )

  console.log('runRoomsStagingPayloadMigration.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
