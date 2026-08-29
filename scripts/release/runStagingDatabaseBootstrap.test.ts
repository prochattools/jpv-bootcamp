import assert from 'node:assert/strict'

import {
  runStagingDatabaseBootstrap,
  type StagingDatabaseBootstrapAuthorization,
} from './runStagingDatabaseBootstrap'

const SHA = '4689a9873d52c8d850c577e8df9dfb531c4aef74'
const DATABASE_URL = 'postgresql://staging_user:masked@10.0.2.4:5433/jpvbootcamp_staging?schema=jpvbootcamp'

function authorization(overrides: Partial<StagingDatabaseBootstrapAuthorization> = {}): StagingDatabaseBootstrapAuthorization {
  return {
    operatorId: 'github.actor',
    backupEvidenceId: 'empty-staging-target-no-data',
    maintenanceWindowId: 'e1-gate-b-20260828',
    rollbackOwner: 'github.actor',
    expectedCommit: SHA,
    environment: 'staging',
    targetId: 'jpvbootcamp-staging',
    expectedSchema: 'jpvbootcamp',
    expectedHostname: '10.0.2.4',
    expectedDatabase: 'jpvbootcamp_staging',
    confirmation: 'bootstrap-empty-staging-database',
    ...overrides,
  }
}

async function main(): Promise<void> {
  let passed = 0
  const test = async (name: string, fn: () => Promise<void>): Promise<void> => {
    await fn()
    passed += 1
    console.log(`PASS ${name}`)
  }

  await test('runs Prisma then Payload and returns verified evidence', async () => {
    const commands: string[] = []
    const result = await runStagingDatabaseBootstrap(DATABASE_URL, authorization(), {
      gitResolver: { branch: () => 'fix/e1-staging-gate-b', commit: () => SHA },
      preflight: async () => ({
        targetWasEmpty: true,
        prismaOnlyInitialized: false,
        payloadAlreadyInitialized: false,
        applicationDataPresent: false,
        currentDatabase: 'jpvbootcamp_staging',
        currentSchema: 'jpvbootcamp',
        currentUserClass: 'staging-role',
      }),
      commandRunner: (executable, args) => {
        commands.push(`${executable} ${args.join(' ')}`)
        return { status: 0 }
      },
      verify: async () => ({
        payloadMigrationCount: 51,
        prismaMigrationCount: 28,
        migrationState: 'VERIFIED',
        applicationPreflight: 'PASSED',
      }),
      log: () => undefined,
    })

    assert.equal(result.ok, true)
    assert.equal(result.preflight.targetWasEmpty, true)
    assert.equal(result.preflight.prismaOnlyInitialized, false)
    assert.equal(result.preflight.payloadAlreadyInitialized, false)
    assert.equal(result.preflight.applicationDataPresent, false)
    assert.deepEqual(commands, [
      './node_modules/.bin/prisma migrate deploy --schema=prisma/system.prisma',
      './node_modules/.bin/payload migrate',
    ])
  })

  await test('rejects a production database identity before commands', async () => {
    let commandCalled = false
    await assert.rejects(
      () => runStagingDatabaseBootstrap(
        'postgresql://user:masked@10.0.2.4:5433/jpvbootcamp?schema=jpvbootcamp',
        authorization(),
        {
          gitResolver: { branch: () => 'fix/e1-staging-gate-b', commit: () => SHA },
          commandRunner: () => {
            commandCalled = true
            return { status: 0 }
          },
          log: () => undefined,
        },
      ),
      /approved staging database/,
    )
    assert.equal(commandCalled, false)
  })

  await test('rejects a non-empty target before commands', async () => {
    let commandCalled = false
    await assert.rejects(
      () => runStagingDatabaseBootstrap(DATABASE_URL, authorization(), {
        gitResolver: { branch: () => 'fix/e1-staging-gate-b', commit: () => SHA },
        preflight: async () => {
          throw new Error('STAGING-BOOTSTRAP-DENIED: staging target is not empty')
        },
        commandRunner: () => {
          commandCalled = true
          return { status: 0 }
        },
        log: () => undefined,
      }),
      /staging target is not empty/,
    )
    assert.equal(commandCalled, false)
  })

  await test('rejects main as a source branch', async () => {
    await assert.rejects(
      () => runStagingDatabaseBootstrap(DATABASE_URL, authorization(), {
        gitResolver: { branch: () => 'main', commit: () => SHA },
        preflight: async () => ({
          targetWasEmpty: true,
          prismaOnlyInitialized: false,
          payloadAlreadyInitialized: false,
          applicationDataPresent: false,
          currentDatabase: 'jpvbootcamp_staging',
          currentSchema: 'jpvbootcamp',
          currentUserClass: 'staging-role',
        }),
        log: () => undefined,
      }),
      /source branch must be feature/,
    )
  })

  console.log(`\n${passed} passed`)
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
