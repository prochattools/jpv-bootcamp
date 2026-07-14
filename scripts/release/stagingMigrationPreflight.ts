import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

type AllowedExecutable = 'git' | 'pnpm'

type CommandStep = {
  id: string
  label: string
  executable: AllowedExecutable
  args: string[]
}

type CheckStep = {
  id: string
  label: string
  run: (cwd: string) => void
}

export type StagingMigrationPreflightStep =
  | ({ kind: 'command' } & CommandStep)
  | ({ kind: 'check' } & CheckStep)

export type CommandResult = {
  status: number | null
  stdout?: string
  stderr?: string
}

export type CommandExecutor = (
  executable: AllowedExecutable,
  args: string[],
  cwd: string,
) => CommandResult

export type RunOptions = {
  cwd?: string
  executor?: CommandExecutor
  log?: (message: string) => void
}

const EXPECTED_BRANCH = 'feature/course-branding-and-preview'
const APPLY_COMMAND = './node_modules/.bin/prisma migrate deploy --schema=prisma/system.prisma'
const RUNBOOK_PATH = 'docs/release/SUPPORT_REQUESTS_MIGRATION_RUNBOOK.md'
const ROLLBACK_PATH = 'docs/client/MIGRATION_REHEARSAL_RUNBOOK.md'
const PREVIEW_READINESS_PATH = 'docs/PREVIEW_RELEASE_READINESS.md'
const OPERATOR_HANDOFF_PATH = 'docs/client/OPERATOR_HANDOFF_SUMMARY.md'
const SUPPORT_MIGRATION_PATH = 'prisma/migrations/20260712_151700_add_support_requests/migration.sql'

function read(cwd: string, relativePath: string): string {
  return readFileSync(path.join(cwd, relativePath), 'utf8')
}

function requireFile(cwd: string, relativePath: string): void {
  if (!existsSync(path.join(cwd, relativePath))) {
    throw new Error(`required_file_missing:${relativePath}`)
  }
}

function defaultExecutor(executable: AllowedExecutable, args: string[], cwd: string): CommandResult {
  const result = spawnSync(executable, args, {
    cwd,
    shell: false,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

function checkBranch(cwd: string): void {
  const branch = execFileSync('git', ['branch', '--show-current'], { cwd, encoding: 'utf8' }).trim()
  if (branch !== EXPECTED_BRANCH) throw new Error(`branch_mismatch:${branch}`)
}

function checkPrismaPathsClean(cwd: string): void {
  const status = execFileSync('git', ['status', '--short', '--', 'prisma', 'prisma/migrations'], {
    cwd,
    encoding: 'utf8',
  }).trim()
  if (status) throw new Error('prisma_paths_dirty')
}

function checkMigrationArtifacts(cwd: string): void {
  for (const file of [
    SUPPORT_MIGRATION_PATH,
    'prisma/migrations/20260712_151700_add_support_requests.test.ts',
    'scripts/support_request_schema_contract.test.ts',
    RUNBOOK_PATH,
    ROLLBACK_PATH,
  ]) {
    requireFile(cwd, file)
  }
}

function checkRunbookContent(cwd: string): void {
  const runbook = read(cwd, RUNBOOK_PATH)
  if (!runbook.includes(APPLY_COMMAND)) throw new Error('apply_command_not_documented')
  if (!/Primary rollback strategy:\s+restore-based/i.test(runbook)) {
    throw new Error('rollback_strategy_not_documented')
  }
  if (!/Do not bundle deployment, provider checks, or application startup/i.test(runbook)) {
    throw new Error('unsafe_apply_sequence')
  }
}

function checkUnappliedEvidence(cwd: string): void {
  const combined = [read(cwd, PREVIEW_READINESS_PATH), read(cwd, OPERATOR_HANDOFF_PATH)].join('\n')
  if (!/No migrations have been applied|Migrations applied:\s*`No`/i.test(combined)) {
    throw new Error('migration_state_not_unapplied')
  }
  if (!/support-request migration remains unapplied/i.test(combined)) {
    throw new Error('support_migration_state_missing')
  }
}

export function buildStagingMigrationPreflightSteps(): StagingMigrationPreflightStep[] {
  return [
    { kind: 'check', id: 'branch', label: 'Verify the feature branch', run: checkBranch },
    { kind: 'check', id: 'prisma-clean', label: 'Verify prisma paths are clean', run: checkPrismaPathsClean },
    { kind: 'check', id: 'artifacts', label: 'Verify migration artifacts exist', run: checkMigrationArtifacts },
    { kind: 'check', id: 'runbook', label: 'Verify the migration runbook contract', run: checkRunbookContent },
    { kind: 'check', id: 'evidence', label: 'Verify repository evidence still marks the migration unapplied', run: checkUnappliedEvidence },
    { kind: 'command', id: 'support-migration-safety', label: 'Run support migration safety test', executable: 'pnpm', args: ['exec', 'tsx', 'prisma/migrations/20260712_151700_add_support_requests.test.ts'] },
    { kind: 'command', id: 'support-schema-contract', label: 'Run support schema contract test', executable: 'pnpm', args: ['exec', 'tsx', 'scripts/support_request_schema_contract.test.ts'] },
    { kind: 'command', id: 'migration-inventory', label: 'Run migration inventory test', executable: 'pnpm', args: ['exec', 'tsx', 'scripts/preview_migration_inventory.test.ts'] },
    { kind: 'command', id: 'migration-readiness', label: 'Run migration readiness test', executable: 'pnpm', args: ['exec', 'tsx', 'scripts/migration_readiness_static.test.ts'] },
    { kind: 'command', id: 'migration-rehearsal', label: 'Run migration rehearsal safety test', executable: 'pnpm', args: ['exec', 'tsx', 'scripts/migration_rehearsal_safety.test.ts'] },
    { kind: 'command', id: 'prisma-system-validate', label: 'Validate prisma/system.prisma', executable: 'pnpm', args: ['exec', 'prisma', 'validate', '--schema=prisma/system.prisma'] },
    { kind: 'command', id: 'prisma-secondary-validate', label: 'Validate prisma/schema.prisma', executable: 'pnpm', args: ['exec', 'prisma', 'validate', '--schema=prisma/schema.prisma'] },
  ]
}

function commandString(step: CommandStep): string {
  return [step.executable, ...step.args].join(' ')
}

export function runStagingMigrationPreflight(options: RunOptions = {}): string {
  const cwd = options.cwd ?? process.cwd()
  const executor = options.executor ?? defaultExecutor
  const log = options.log ?? console.log
  const steps = buildStagingMigrationPreflightSteps()
  let completed = 0

  log('STAGING MIGRATION PREFLIGHT')
  log(`Branch must remain: ${EXPECTED_BRANCH}`)
  log('Mode: read-only')

  for (const step of steps) {
    log(`RUN ${step.id}: ${step.label}`)
    if (step.kind === 'check') {
      step.run(cwd)
      completed += 1
      log(`PASS ${step.id}`)
      continue
    }

    const result = executor(step.executable, step.args, cwd)
    if (result.status !== 0) {
      if (result.stdout?.trim()) log(`STDOUT ${step.id}:\n${result.stdout.trim()}`)
      if (result.stderr?.trim()) log(`STDERR ${step.id}:\n${result.stderr.trim()}`)
      throw new Error(`STAGING MIGRATION PREFLIGHT FAILED: ${step.id} (${commandString(step)})`)
    }
    completed += 1
    log(`PASS ${step.id}`)
  }

  const summary = `STAGING MIGRATION PREFLIGHT PASSED: ${completed}/${steps.length}`
  log(summary)
  return summary
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  try {
    runStagingMigrationPreflight()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
