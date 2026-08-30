import assert from 'node:assert/strict'

import {
  ROOMS_STAGING_ROLLBACK_CONFIRMATION,
  runRoomsStagingRollbackPreparation,
  parseRoomsStagingRollbackPreparationArgs,
  type RoomsStagingRollbackPreparationAuthorization,
} from './prepareRoomsStagingRollback'

const EXPECTED_COMMIT = 'a4081d12c7141ed8f5476077536c5234a555f240'

function authorization(
  overrides: Partial<RoomsStagingRollbackPreparationAuthorization> = {},
): RoomsStagingRollbackPreparationAuthorization {
  return {
    operatorId: 'operator-1',
    backupEvidenceId: 'rooms-backup-20260830-1',
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
    backupHost: '100.71.47.24',
    backupUser: 'ubuntu',
    confirmation: ROOMS_STAGING_ROLLBACK_CONFIRMATION,
    ...overrides,
  }
}

function preparedRemoteResult(): string {
  return JSON.stringify({
    version: 1,
    operation: 'prepare-rooms-staging-rollback',
    ok: true,
    resultCode: 'prepared',
    environment: 'staging',
    targetId: 'jpvbootcamp-staging',
    schema: 'jpvbootcamp',
    commit: EXPECTED_COMMIT,
    sourceTip: EXPECTED_COMMIT,
    migration: '20260830_090000_member_portal_rooms',
    backup: {
      evidenceId: 'rooms-backup-20260830-1',
      location: '/var/backups/pgdump/jpvbootcamp_staging/rooms-rooms-backup-20260830-1.dump',
      sha256: 'a'.repeat(64),
      bytes: 12345,
      databaseIdentity: 'jpvbootcamp_staging|jpvbootcamp|10.0.2.4|5433',
      restoreTest: 'passed',
    },
    blockers: [],
  })
}

function dependencies(
  remoteResult: { status: number | null; stdout?: string },
  argsSeen: { args?: string[]; input?: string } = {},
) {
  return {
    gitResolver: {
      branch: () => 'feature/member-portal-rooms',
      commit: () => EXPECTED_COMMIT,
    },
    gitStatusResolver: () => '',
    remoteExecutor: (args: string[], input: string) => {
      argsSeen.args = args
      argsSeen.input = input
      return remoteResult
    },
  }
}

async function main(): Promise<void> {
  const parsed = parseRoomsStagingRollbackPreparationArgs([
    '--operator-id=operator-1',
    '--backup-evidence-id=rooms-backup-20260830-1',
    '--maintenance-window-id=maintenance-1',
    '--rollback-owner=rollback-owner-1',
    `--expected-commit=${EXPECTED_COMMIT}`,
    `--source-tip=${EXPECTED_COMMIT}`,
    '--environment=staging',
    '--target-id=jpvbootcamp-staging',
    '--expected-schema=jpvbootcamp',
    '--expected-hostname=10.0.2.4',
    '--expected-database=jpvbootcamp_staging',
    '--expected-port=5433',
    '--backup-host=100.71.47.24',
    '--backup-user=ubuntu',
    `--confirmation=${ROOMS_STAGING_ROLLBACK_CONFIRMATION}`,
  ])
  assert.equal(parsed.backupHost, '100.71.47.24')

  const commandSeen: { args?: string[]; input?: string } = {}
  const prepared = runRoomsStagingRollbackPreparation(
    authorization(),
    dependencies({ status: 0, stdout: preparedRemoteResult() }, commandSeen),
  )
  assert.equal(prepared.ok, true)
  assert.equal(prepared.resultCode, 'prepared')
  assert.equal(prepared.backup?.restoreTest, 'passed')
  assert.equal(prepared.backup?.sha256, 'a'.repeat(64))
  assert.ok(commandSeen.args?.includes('ubuntu@100.71.47.24'))
  assert.doesNotMatch(commandSeen.args?.join(' ') ?? '', /DATABASE_URL|postgresql?:\/\//i)
  assert.match(commandSeen.input ?? '', /pg_dump --format=custom/)
  assert.match(commandSeen.input ?? '', /pg_restore --exit-on-error/)
  assert.match(commandSeen.input ?? '', /jpvbootcamp_staging/)
  assert.doesNotMatch(commandSeen.input ?? '', /https?:\/\/jpvbootcamp\.com/i)

  const blocked = runRoomsStagingRollbackPreparation(
    authorization(),
    dependencies({
      status: 1,
      stdout: JSON.stringify({
        version: 1,
        operation: 'prepare-rooms-staging-rollback',
        ok: false,
        resultCode: 'blocked',
        environment: 'staging',
        targetId: 'jpvbootcamp-staging',
        schema: 'jpvbootcamp',
        commit: EXPECTED_COMMIT,
        sourceTip: EXPECTED_COMMIT,
        migration: '20260830_090000_member_portal_rooms',
        blockers: ['backup_directory_not_protected'],
      }),
    }),
  )
  assert.equal(blocked.ok, false)
  assert.equal(blocked.resultCode, 'blocked')
  assert.deepEqual(blocked.blockers, ['backup_directory_not_protected'])

  const uncertain = runRoomsStagingRollbackPreparation(
    authorization(),
    dependencies({ status: 255 }),
  )
  assert.equal(uncertain.ok, false)
  assert.equal(uncertain.resultCode, 'uncertain')
  assert.deepEqual(uncertain.blockers, ['backup_preparation_outcome_uncertain'])

  assert.throws(
    () => runRoomsStagingRollbackPreparation(
      authorization({ backupHost: '10.0.2.4' }),
      dependencies({ status: 0, stdout: preparedRemoteResult() }),
    ),
    /backup_host_not_staging/,
  )

  assert.throws(
    () => runRoomsStagingRollbackPreparation(
      authorization({ sourceTip: 'b'.repeat(40) }),
      {
        ...dependencies({ status: 0, stdout: preparedRemoteResult() }),
        candidateAncestorResolver: () => false,
        gitResolver: {
          branch: () => 'feature/member-portal-rooms',
          commit: () => 'b'.repeat(40),
        },
      },
    ),
    /candidate_not_in_approved_source/,
  )

  console.log('prepareRoomsStagingRollback.test.ts passed')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
