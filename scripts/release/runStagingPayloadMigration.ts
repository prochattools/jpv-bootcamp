import { execSync, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

import {
  buildStagingMigrationStatus,
  createStagingReadOnlyAdapter,
  type MigrationEvidenceAdapter,
  type PgClientFactory,
} from './buildStagingMigrationStatus'

const REQUIRED_BRANCH = 'feature/course-branding-and-preview'
// Pinned to the migration-29 commit reviewed and authorized for this runner.
// Update to the ops commit hash before executing apply mode in staging.
const REQUIRED_COMMIT = '969113bcbee5cbdc01a274d7ab3e5cafdc94ecca'
const REQUIRED_SCHEMA = 'jpvbootcamp_staging'
const TARGET_MIGRATION = '20260804_050000_member_account_action_reservations'
const EXPECTED_APPLIED_BEFORE = 28
const EXPECTED_APPLIED_AFTER = 29
const APPLY_CONFIRMATION_VALUE =
  'apply_account_action_reservation_migration_to_jpvbootcamp_staging'

const repoRoot = resolve(__dirname, '../../')

export type MigrationAuthorizationPacket = {
  operatorId: string
  backupEvidenceId: string
  maintenanceWindowId: string
  rollbackOwner: string
  confirmation: string
}

export type StagingMigrationPlanResult = {
  ok: boolean
  mode: 'plan'
  branch: string
  commit: string
  schema: string
  appliedCount: number
  pendingMigrations: string[]
  blockers: string[]
  message: string
}

export type StagingMigrationApplyResult = {
  ok: true
  mode: 'apply'
  branch: string
  commit: string
  schema: string
  authorization: Omit<MigrationAuthorizationPacket, 'confirmation'>
  preApply: { appliedCount: number; missingMigrations: string[] }
  postApply: { appliedCount: number; missingMigrations: string[] }
  message: string
}

export type StagingMigrationRunnerDependencies = {
  clientFactory?: PgClientFactory
  commandExecutor?: (
    command: string,
    args: string[],
  ) => { status: number | null; error?: Error }
  gitResolver?: {
    branch: () => string
    commit: () => string
  }
}

function resolveGit(
  dependencies: StagingMigrationRunnerDependencies,
): { branch: () => string; commit: () => string } {
  if (dependencies.gitResolver) return dependencies.gitResolver
  return {
    branch: () =>
      execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: repoRoot,
        encoding: 'utf8',
      }).trim(),
    commit: () =>
      execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim(),
  }
}

function resolveCommandExecutor(
  dependencies: StagingMigrationRunnerDependencies,
): (command: string, args: string[]) => { status: number | null; error?: Error } {
  if (dependencies.commandExecutor) return dependencies.commandExecutor
  return (command: string, args: string[]) => {
    const result = spawnSync(command, args, {
      env: process.env,
      stdio: 'inherit',
      cwd: repoRoot,
    })
    return { status: result.status, error: result.error }
  }
}

function guardBranchAndCommit(git: {
  branch: () => string
  commit: () => string
}): { branch: string; commit: string } {
  const branch = git.branch()
  const commit = git.commit()
  if (branch !== REQUIRED_BRANCH) {
    throw new Error(
      `Branch guard: expected '${REQUIRED_BRANCH}', got '${branch}'`,
    )
  }
  if (commit !== REQUIRED_COMMIT) {
    throw new Error(
      `Commit guard: expected '${REQUIRED_COMMIT}', got '${commit}'`,
    )
  }
  return { branch, commit }
}

type PreApplyStatus = {
  appliedCount: number
  missingMigrations: string[]
  unexpectedMigrations: string[]
}

async function collectMigrationStatus(
  databaseUrl: string,
  schemaOverride: string | undefined,
  dependencies: StagingMigrationRunnerDependencies,
): Promise<PreApplyStatus> {
  const adapter = createStagingReadOnlyAdapter({
    databaseUrl,
    expectedSchema: REQUIRED_SCHEMA,
    schemaOverride,
    clientFactory: dependencies.clientFactory,
  })
  const status = await buildStagingMigrationStatus(adapter, REQUIRED_SCHEMA)
  return {
    appliedCount: status.appliedPayloadMigrations.length,
    missingMigrations: status.missingPayloadMigrations,
    unexpectedMigrations: status.unexpectedPayloadMigrations,
  }
}

export async function runStagingMigrationPlan(
  databaseUrl: string | undefined,
  schemaOverride: string | undefined,
  dependencies: StagingMigrationRunnerDependencies = {},
  output: (line: string) => void = console.log,
): Promise<StagingMigrationPlanResult> {
  const git = resolveGit(dependencies)
  let branch = 'unknown'
  let commit = 'unknown'

  try {
    ;({ branch, commit } = guardBranchAndCommit(git))
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Branch/commit guard failed'
    output(`[staging-migration-plan] BLOCKED: ${message}`)
    return { ok: false, mode: 'plan', branch, commit, schema: REQUIRED_SCHEMA, appliedCount: 0, pendingMigrations: [], blockers: [message], message }
  }

  output(`[staging-migration-plan] branch=${branch}`)
  output(`[staging-migration-plan] commit=${commit}`)
  output(`[staging-migration-plan] schema=${REQUIRED_SCHEMA}`)
  output(`[staging-migration-plan] mode=plan (read-only, no database mutations)`)

  if (!databaseUrl) {
    const message = 'DATABASE_URL is not set; cannot collect live migration status'
    output(`[staging-migration-plan] BLOCKED: ${message}`)
    return { ok: false, mode: 'plan', branch, commit, schema: REQUIRED_SCHEMA, appliedCount: 0, pendingMigrations: [], blockers: [message], message }
  }

  let preStatus: PreApplyStatus
  try {
    preStatus = await collectMigrationStatus(databaseUrl, schemaOverride, dependencies)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to collect migration status'
    output(`[staging-migration-plan] BLOCKED: ${message}`)
    return { ok: false, mode: 'plan', branch, commit, schema: REQUIRED_SCHEMA, appliedCount: 0, pendingMigrations: [], blockers: [message], message }
  }

  const blockers: string[] = []
  if (preStatus.appliedCount !== EXPECTED_APPLIED_BEFORE) {
    blockers.push(
      `Expected ${EXPECTED_APPLIED_BEFORE} applied migrations before apply, found ${preStatus.appliedCount}`,
    )
  }
  if (
    preStatus.missingMigrations.length !== 1 ||
    preStatus.missingMigrations[0] !== TARGET_MIGRATION
  ) {
    blockers.push(
      `Expected exactly one missing migration (${TARGET_MIGRATION}), found: [${preStatus.missingMigrations.join(', ')}]`,
    )
  }
  if (preStatus.unexpectedMigrations.length > 0) {
    blockers.push(
      `Unexpected migration records exist: [${preStatus.unexpectedMigrations.join(', ')}]`,
    )
  }

  output(`[staging-migration-plan] applied=${preStatus.appliedCount}`)
  output(`[staging-migration-plan] missing=[${preStatus.missingMigrations.join(', ')}]`)
  output(`[staging-migration-plan] unexpected=[${preStatus.unexpectedMigrations.join(', ')}]`)

  if (blockers.length > 0) {
    for (const blocker of blockers) {
      output(`[staging-migration-plan] BLOCKER: ${blocker}`)
    }
    const message = `Plan blockers: ${blockers.join('; ')}`
    return {
      ok: false,
      mode: 'plan',
      branch,
      commit,
      schema: REQUIRED_SCHEMA,
      appliedCount: preStatus.appliedCount,
      pendingMigrations: preStatus.missingMigrations,
      blockers,
      message,
    }
  }

  output(
    `[staging-migration-plan] PLAN OK: ${TARGET_MIGRATION} is pending and all preconditions are met`,
  )
  output(`[staging-migration-plan] To apply: pnpm staging:payload-migration-apply`)
  return {
    ok: true,
    mode: 'plan',
    branch,
    commit,
    schema: REQUIRED_SCHEMA,
    appliedCount: preStatus.appliedCount,
    pendingMigrations: preStatus.missingMigrations,
    blockers: [],
    message: `Plan OK: ${TARGET_MIGRATION} is pending and preconditions are met`,
  }
}

export async function runStagingMigrationApply(
  databaseUrl: string | undefined,
  schemaOverride: string | undefined,
  authorization: MigrationAuthorizationPacket,
  dependencies: StagingMigrationRunnerDependencies = {},
  output: (line: string) => void = console.log,
): Promise<StagingMigrationApplyResult> {
  const git = resolveGit(dependencies)
  const { branch, commit } = guardBranchAndCommit(git)

  if (!authorization.operatorId?.trim()) {
    throw new Error('Authorization packet: operatorId is required')
  }
  if (!authorization.backupEvidenceId?.trim()) {
    throw new Error('Authorization packet: backupEvidenceId is required')
  }
  if (!authorization.maintenanceWindowId?.trim()) {
    throw new Error('Authorization packet: maintenanceWindowId is required')
  }
  if (!authorization.rollbackOwner?.trim()) {
    throw new Error('Authorization packet: rollbackOwner is required')
  }
  if (authorization.confirmation !== APPLY_CONFIRMATION_VALUE) {
    throw new Error(
      `Authorization packet: confirmation must be exactly '${APPLY_CONFIRMATION_VALUE}'`,
    )
  }
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set; cannot apply migration')
  }

  output(`[staging-migration-apply] branch=${branch}`)
  output(`[staging-migration-apply] commit=${commit}`)
  output(`[staging-migration-apply] schema=${REQUIRED_SCHEMA}`)
  output(`[staging-migration-apply] operator=${authorization.operatorId}`)
  output(`[staging-migration-apply] maintenanceWindow=${authorization.maintenanceWindowId}`)
  output(`[staging-migration-apply] backupEvidence=${authorization.backupEvidenceId}`)
  output(`[staging-migration-apply] rollbackOwner=${authorization.rollbackOwner}`)

  output(`[staging-migration-apply] collecting pre-apply migration status...`)
  let preStatus: PreApplyStatus
  try {
    preStatus = await collectMigrationStatus(databaseUrl, schemaOverride, dependencies)
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Failed to collect pre-apply migration status'
    throw new Error(`Pre-apply status check failed: ${message}`)
  }

  if (preStatus.appliedCount !== EXPECTED_APPLIED_BEFORE) {
    throw new Error(
      `Pre-apply check failed: expected ${EXPECTED_APPLIED_BEFORE} applied migrations, found ${preStatus.appliedCount}`,
    )
  }
  if (
    preStatus.missingMigrations.length !== 1 ||
    preStatus.missingMigrations[0] !== TARGET_MIGRATION
  ) {
    throw new Error(
      `Pre-apply check failed: expected exactly one missing migration (${TARGET_MIGRATION}), found: [${preStatus.missingMigrations.join(', ')}]`,
    )
  }
  if (preStatus.unexpectedMigrations.length > 0) {
    throw new Error(
      `Pre-apply check failed: unexpected migration records exist: [${preStatus.unexpectedMigrations.join(', ')}]`,
    )
  }

  output(`[staging-migration-apply] pre-apply checks PASSED`)
  output(`[staging-migration-apply] applying migration: ${TARGET_MIGRATION}`)
  output(`[staging-migration-apply] invoking: pnpm payload migrate`)

  const executor = resolveCommandExecutor(dependencies)
  const execResult = executor('pnpm', ['payload', 'migrate'])
  if (execResult.error) {
    throw new Error(`Migration command error: ${execResult.error.message}`)
  }
  if (execResult.status !== 0) {
    throw new Error(
      `Migration command exited with status ${execResult.status ?? 'unknown'}. Rollback: pnpm payload migrate:down`,
    )
  }

  output(`[staging-migration-apply] migration command completed`)
  output(`[staging-migration-apply] collecting post-apply migration status...`)

  let postStatus: PreApplyStatus
  try {
    postStatus = await collectMigrationStatus(databaseUrl, schemaOverride, dependencies)
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Post-apply status query failed'
    throw new Error(`Post-apply verification failed: ${message}`)
  }

  if (postStatus.appliedCount !== EXPECTED_APPLIED_AFTER) {
    throw new Error(
      `Post-apply verification failed: expected ${EXPECTED_APPLIED_AFTER} applied migrations, found ${postStatus.appliedCount}`,
    )
  }
  if (postStatus.missingMigrations.length > 0) {
    throw new Error(
      `Post-apply verification failed: missing migrations after apply: [${postStatus.missingMigrations.join(', ')}]`,
    )
  }
  if (postStatus.unexpectedMigrations.length > 0) {
    throw new Error(
      `Post-apply verification failed: unexpected migration records: [${postStatus.unexpectedMigrations.join(', ')}]`,
    )
  }

  output(`[staging-migration-apply] post-apply verification PASSED`)
  output(
    `[staging-migration-apply] all ${EXPECTED_APPLIED_AFTER} migrations applied. Rollback if needed: pnpm payload migrate:down`,
  )

  return {
    ok: true,
    mode: 'apply',
    branch,
    commit,
    schema: REQUIRED_SCHEMA,
    authorization: {
      operatorId: authorization.operatorId,
      backupEvidenceId: authorization.backupEvidenceId,
      maintenanceWindowId: authorization.maintenanceWindowId,
      rollbackOwner: authorization.rollbackOwner,
    },
    preApply: {
      appliedCount: preStatus.appliedCount,
      missingMigrations: preStatus.missingMigrations,
    },
    postApply: {
      appliedCount: postStatus.appliedCount,
      missingMigrations: postStatus.missingMigrations,
    },
    message: `Apply completed: ${TARGET_MIGRATION} applied to ${REQUIRED_SCHEMA}. Rollback: pnpm payload migrate:down`,
  }
}

export function parseApplyCliArgs(args: string[]): MigrationAuthorizationPacket {
  const result: Partial<MigrationAuthorizationPacket> = {}
  for (const arg of args) {
    const eq = arg.indexOf('=')
    if (eq < 0) throw new Error(`Unexpected positional argument: ${arg}`)
    const key = arg.slice(0, eq)
    const value = arg.slice(eq + 1)
    if (!value) throw new Error(`Missing value for ${key}`)
    if (key === '--operator-id') result.operatorId = value
    else if (key === '--backup-evidence-id') result.backupEvidenceId = value
    else if (key === '--maintenance-window-id') result.maintenanceWindowId = value
    else if (key === '--rollback-owner') result.rollbackOwner = value
    else if (key === '--confirmation') result.confirmation = value
    else throw new Error(`Unknown argument: ${key}`)
  }
  if (!result.operatorId) throw new Error('Missing required argument: --operator-id')
  if (!result.backupEvidenceId) throw new Error('Missing required argument: --backup-evidence-id')
  if (!result.maintenanceWindowId)
    throw new Error('Missing required argument: --maintenance-window-id')
  if (!result.rollbackOwner) throw new Error('Missing required argument: --rollback-owner')
  if (!result.confirmation) throw new Error('Missing required argument: --confirmation')
  return result as MigrationAuthorizationPacket
}

const PLAN_USAGE = [
  'Usage: pnpm staging:payload-migration-plan',
  'Performs a read-only pre-flight check for the account_action_reservation migration.',
  'This command does NOT mutate the database.',
  'Authorization does NOT authorize push, Dokploy redeployment, Prisma database-deploy,',
  'provider email, post-deployment smoke, or production.',
].join('\n')

const APPLY_USAGE = [
  'Usage: pnpm staging:payload-migration-apply -- \\',
  '  --operator-id=<id> \\',
  '  --backup-evidence-id=<id> \\',
  '  --maintenance-window-id=<id> \\',
  '  --rollback-owner=<id> \\',
  `  --confirmation=${APPLY_CONFIRMATION_VALUE}`,
  '',
  `Applies migration ${TARGET_MIGRATION} to the ${REQUIRED_SCHEMA} schema.`,
  'Authorization does NOT authorize push, Dokploy redeployment, Prisma database-deploy,',
  'provider email, post-deployment smoke, or production.',
].join('\n')

async function main(): Promise<void> {
  const [subcommand, ...rest] = process.argv.slice(2)

  if (!subcommand || subcommand === 'plan') {
    const result = await runStagingMigrationPlan(
      process.env.DATABASE_URL,
      process.env.PAYLOAD_MIGRATION_SCHEMA,
    )
    console.log(JSON.stringify(result, null, 2))
    process.exit(result.ok ? 0 : 1)
    return
  }

  if (subcommand === 'apply') {
    let authorization: MigrationAuthorizationPacket
    try {
      authorization = parseApplyCliArgs(rest)
    } catch (error: unknown) {
      console.error(APPLY_USAGE)
      console.error(error instanceof Error ? error.message : 'Invalid arguments')
      process.exit(1)
    }
    try {
      const result = await runStagingMigrationApply(
        process.env.DATABASE_URL,
        process.env.PAYLOAD_MIGRATION_SCHEMA,
        authorization,
      )
      console.log(JSON.stringify(result, null, 2))
      process.exit(0)
    } catch (error: unknown) {
      console.error(
        '[staging-migration-apply] FAILED:',
        error instanceof Error ? error.message : error,
      )
      process.exit(1)
    }
    return
  }

  console.error(PLAN_USAGE)
  console.error(APPLY_USAGE)
  process.exit(1)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(
      '[staging-migration] FATAL:',
      error instanceof Error ? error.message : error,
    )
    process.exitCode = 1
  })
}
