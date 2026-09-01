import { execSync, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

import { PAYLOAD_MIGRATION_NAMES } from '../../src/lib/payloadMigrationRegistry'
import { ENVIRONMENT_TOPOLOGY, isAllowedStagingSourceRef } from '../../src/lib/environmentTopology'
import {
  buildStagingMigrationStatus,
  createStagingReadOnlyAdapter,
  type PgClientFactory,
  type StagingMigrationStatusReport,
} from './buildStagingMigrationStatus'

export const ROOMS_STAGING_MIGRATION = '20260830_090000_member_portal_rooms' as const
const roomsMigrationIndex = PAYLOAD_MIGRATION_NAMES.indexOf(ROOMS_STAGING_MIGRATION)
if (roomsMigrationIndex < 0) throw new Error('rooms_staging_migration_not_registered')
// This control is intentionally frozen at the Rooms migration boundary. Later
// migrations must be released through their own approved rollout, never as an
// accidental side effect of replaying this historical migration control.
export const ROOMS_STAGING_REGISTERED_PAYLOAD_MIGRATIONS = PAYLOAD_MIGRATION_NAMES.slice(0, roomsMigrationIndex + 1)
export const ROOMS_STAGING_CONFIRMATION = 'apply-rooms-migration-to-jpvbootcamp-staging' as const
export const ROOMS_STAGING_TARGET = {
  environment: 'staging',
  targetId: 'jpvbootcamp-staging',
  database: ENVIRONMENT_TOPOLOGY.staging.database,
  schema: 'jpvbootcamp',
  hostname: '10.0.2.4',
  port: '5433',
} as const
export const ROOMS_STAGING_PAYLOAD_MIGRATE_ARGS = ['./node_modules/.bin/payload', 'migrate'] as const

const repoRoot = resolve(__dirname, '../../')
const FULL_COMMIT_SHA_RE = /^[0-9a-f]{40}$/
const SAFE_REFERENCE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

type GitResolver = {
  branch: () => string
  commit: () => string
}

export type RoomsStagingMigrationDependencies = {
  clientFactory?: PgClientFactory
  commandExecutor?: (args: string[]) => { status: number | null; error?: Error }
  gitResolver?: GitResolver
  gitStatusResolver?: () => string
  candidateAncestorResolver?: (candidate: string, sourceTip: string) => boolean
}

export type RoomsStagingMigrationAuthorization = {
  operatorId: string
  backupEvidenceId: string
  maintenanceWindowId: string
  rollbackOwner: string
  expectedCommit: string
  sourceTip: string
  environment: string
  targetId: string
  expectedSchema: string
  expectedHostname: string
  expectedDatabase: string
  expectedPort: string
  confirmation: string
  migrationApproval: string
  rollbackReadiness: string
}

type MigrationState = {
  schemaIdentity: string | null
  appliedPayloadCount: number
  missingPayloadMigrations: string[]
  unexpectedPayloadMigrations: string[]
  duplicatePayloadMigrations: string[]
  malformedPayloadCount: number
  orderingAnomalyCount: number
  prismaHealthy: boolean
  unhealthyPrismaMigrations: string[]
  report: StagingMigrationStatusReport
}

export type RoomsStagingMigrationResult = {
  version: 1
  operation: 'apply-rooms-migration'
  ok: boolean
  resultCode: 'applied' | 'blocked' | 'uncertain'
  environment: string
  targetId: string
  schema: string
  commit: string
  sourceTip: string
  migration: typeof ROOMS_STAGING_MIGRATION
  preApply?: MigrationStateEvidence
  postApply?: MigrationStateEvidence
  targetMigrationApplied?: boolean | null
  authorizationEvidence?: {
    operatorId: string
    backupEvidenceId: string
    maintenanceWindowId: string
    rollbackOwner: string
  }
  blockers: string[]
}

export type MigrationStateEvidence = {
  schemaIdentity: string | null
  appliedPayloadCount: number
  missingPayloadMigrations: string[]
  unexpectedPayloadCount: number
  duplicatePayloadCount: number
  malformedPayloadCount: number
  orderingAnomalyCount: number
  prismaHealthy: boolean
  unhealthyPrismaMigrations?: string[]
}

function resolveGit(dependencies: RoomsStagingMigrationDependencies): GitResolver {
  if (dependencies.gitResolver) return dependencies.gitResolver
  return {
    branch: () => execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim(),
    commit: () => execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim(),
  }
}

function resolveGitStatus(dependencies: RoomsStagingMigrationDependencies): () => string {
  if (dependencies.gitStatusResolver) return dependencies.gitStatusResolver
  return () => execSync('git status --porcelain=v1 --untracked-files=all', { cwd: repoRoot, encoding: 'utf8' })
}

function resolveCommandExecutor(
  dependencies: RoomsStagingMigrationDependencies,
): (args: string[]) => { status: number | null; error?: Error } {
  if (dependencies.commandExecutor) return dependencies.commandExecutor
  return (args) => {
    const [executable, ...rest] = args
    const result = spawnSync(executable, rest, {
      cwd: repoRoot,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 180_000,
    })
    // stdout/stderr are intentionally never forwarded: Payload output can
    // contain connection diagnostics, while this operation emits sanitized evidence only.
    return { status: result.status, error: result.error }
  }
}

function isCandidateAncestor(
  candidate: string,
  sourceTip: string,
  dependencies: RoomsStagingMigrationDependencies,
): boolean {
  if (candidate === sourceTip) return true
  if (dependencies.candidateAncestorResolver) return dependencies.candidateAncestorResolver(candidate, sourceTip)
  return spawnSync('git', ['merge-base', '--is-ancestor', candidate, sourceTip], {
    cwd: repoRoot,
    shell: false,
    stdio: 'ignore',
  }).status === 0
}

function requireNonEmpty(value: string | undefined, label: string): string {
  if (!value?.trim()) throw new Error(`authorization_${label}_missing`)
  return value.trim()
}

function requireReference(value: string | undefined, label: string): string {
  const reference = requireNonEmpty(value, label)
  if (!SAFE_REFERENCE_RE.test(reference)) throw new Error(`authorization_${label}_invalid`)
  return reference
}

function validateAuthorization(authorization: RoomsStagingMigrationAuthorization): void {
  requireReference(authorization.operatorId, 'operator')
  requireReference(authorization.backupEvidenceId, 'backup_evidence')
  requireReference(authorization.maintenanceWindowId, 'maintenance_window')
  requireReference(authorization.rollbackOwner, 'rollback_owner')
  if (!FULL_COMMIT_SHA_RE.test(requireNonEmpty(authorization.expectedCommit, 'commit').toLowerCase())) {
    throw new Error('authorization_commit_invalid')
  }
  if (!FULL_COMMIT_SHA_RE.test(requireNonEmpty(authorization.sourceTip, 'source_tip').toLowerCase())) {
    throw new Error('authorization_source_tip_invalid')
  }
  if (authorization.environment !== ROOMS_STAGING_TARGET.environment) throw new Error('environment_not_staging')
  if (authorization.targetId !== ROOMS_STAGING_TARGET.targetId) throw new Error('target_id_not_staging')
  if (authorization.expectedSchema !== ROOMS_STAGING_TARGET.schema) throw new Error('schema_not_staging')
  if (authorization.expectedHostname !== ROOMS_STAGING_TARGET.hostname) throw new Error('hostname_not_staging')
  if (authorization.expectedDatabase !== ROOMS_STAGING_TARGET.database) throw new Error('database_not_staging')
  if (authorization.expectedPort !== ROOMS_STAGING_TARGET.port) throw new Error('port_not_staging')
  if (authorization.confirmation !== ROOMS_STAGING_CONFIRMATION) throw new Error('confirmation_invalid')
  if (authorization.migrationApproval !== 'approved') throw new Error('migration_approval_not_confirmed')
  if (authorization.rollbackReadiness !== 'ready') throw new Error('rollback_readiness_not_confirmed')
}

function parseDatabaseUrl(databaseUrl: string): { hostname: string; port: string; database: string } {
  let parsed: URL
  try {
    parsed = new URL(databaseUrl)
  } catch {
    throw new Error('database_url_invalid')
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') throw new Error('database_url_invalid')
  const database = parsed.pathname.replace(/^\//, '').split('?')[0]
  if (!parsed.hostname || !database) throw new Error('database_url_invalid')
  return { hostname: parsed.hostname, port: parsed.port, database }
}

function guardDatabaseTarget(databaseUrl: string, authorization: RoomsStagingMigrationAuthorization): void {
  const actual = parseDatabaseUrl(databaseUrl)
  const productionTokens = new Set(['prod', 'production', 'live', 'main'])
  const tokens = `${actual.hostname} ${actual.database}`.toLowerCase().split(/[\s.:\-_/]+/).filter(Boolean)
  if (tokens.some((token) => productionTokens.has(token))) throw new Error('production_target_rejected')
  if (actual.hostname !== ROOMS_STAGING_TARGET.hostname || actual.hostname !== authorization.expectedHostname) {
    throw new Error('database_hostname_mismatch')
  }
  if (actual.port !== ROOMS_STAGING_TARGET.port || actual.port !== authorization.expectedPort) {
    throw new Error('database_port_mismatch')
  }
  if (actual.database !== ROOMS_STAGING_TARGET.database || actual.database !== authorization.expectedDatabase) {
    throw new Error('database_name_mismatch')
  }
}

function guardSourceAndWorktree(
  dependencies: RoomsStagingMigrationDependencies,
  expectedCommit: string,
  sourceTip: string,
): { branch: string; commit: string } {
  const git = resolveGit(dependencies)
  const branch = git.branch()
  const commit = git.commit()
  if (!isAllowedStagingSourceRef(branch)) throw new Error('source_ref_not_allowed')
  if (commit !== sourceTip.toLowerCase()) throw new Error('source_tip_mismatch')
  if (!isCandidateAncestor(expectedCommit.toLowerCase(), sourceTip.toLowerCase(), dependencies)) {
    throw new Error('candidate_not_in_approved_source')
  }
  if (resolveGitStatus(dependencies)().trim()) throw new Error('worktree_not_clean')
  return { branch, commit: expectedCommit.toLowerCase() }
}

async function collectState(
  databaseUrl: string,
  schemaOverride: string | undefined,
  dependencies: RoomsStagingMigrationDependencies,
): Promise<MigrationState> {
  const adapter = createStagingReadOnlyAdapter({
    databaseUrl,
    expectedSchema: ROOMS_STAGING_TARGET.schema,
    schemaOverride,
    clientFactory: dependencies.clientFactory,
  })
  const report = await buildStagingMigrationStatus(
    adapter,
    ROOMS_STAGING_TARGET.schema,
    ROOMS_STAGING_REGISTERED_PAYLOAD_MIGRATIONS,
  )
  const names = report.prismaMigrations.map((row) => row.migrationName)
  const duplicatePrismaNames = names.filter((name, index) => names.indexOf(name) !== index)
  const unhealthyPrismaMigrations = report.prismaMigrations
    .filter((row) => row.status !== 'applied')
    .map((row) => `${row.migrationName}:${row.status}`)
  return {
    schemaIdentity: report.schemaIdentity,
    appliedPayloadCount: report.appliedPayloadMigrations.length,
    missingPayloadMigrations: [...report.missingPayloadMigrations],
    unexpectedPayloadMigrations: [...report.unexpectedPayloadMigrations],
    duplicatePayloadMigrations: [...report.duplicatePayloadMigrations],
    malformedPayloadCount: report.malformedPayloadMigrationRecords.length,
    orderingAnomalyCount: report.orderingAnomalies.length,
    prismaHealthy:
      report.prismaMigrations.length > 0 &&
      report.missingPrismaMigrations.length === 0 &&
      report.unexpectedPrismaMigrations.length === 0 &&
      duplicatePrismaNames.length === 0 &&
      unhealthyPrismaMigrations.length === 0,
    unhealthyPrismaMigrations,
    report,
  }
}

function evidence(state: MigrationState): MigrationStateEvidence {
  const result: MigrationStateEvidence = {
    schemaIdentity: state.schemaIdentity,
    appliedPayloadCount: state.appliedPayloadCount,
    missingPayloadMigrations: [...state.missingPayloadMigrations],
    unexpectedPayloadCount: state.unexpectedPayloadMigrations.length,
    duplicatePayloadCount: state.duplicatePayloadMigrations.length,
    malformedPayloadCount: state.malformedPayloadCount,
    orderingAnomalyCount: state.orderingAnomalyCount,
    prismaHealthy: state.prismaHealthy,
  }
  if (state.unhealthyPrismaMigrations.length > 0) result.unhealthyPrismaMigrations = [...state.unhealthyPrismaMigrations]
  return result
}

function preApplyBlockers(state: MigrationState): string[] {
  const blockers: string[] = []
  const expectedApplied = ROOMS_STAGING_REGISTERED_PAYLOAD_MIGRATIONS.length - 1
  if (state.schemaIdentity !== ROOMS_STAGING_TARGET.schema) blockers.push('schema_identity_mismatch')
  if (state.appliedPayloadCount !== expectedApplied) blockers.push('applied_count_mismatch')
  if (state.missingPayloadMigrations.length !== 1 || state.missingPayloadMigrations[0] !== ROOMS_STAGING_MIGRATION) {
    blockers.push('pending_migration_mismatch')
  }
  if (state.unexpectedPayloadMigrations.length > 0) blockers.push('unexpected_payload_migrations')
  if (state.duplicatePayloadMigrations.length > 0) blockers.push('duplicate_payload_migrations')
  if (state.malformedPayloadCount > 0) blockers.push('malformed_payload_evidence')
  if (state.orderingAnomalyCount > 0) blockers.push('ordering_anomalies')
  if (!state.prismaHealthy) blockers.push('prisma_not_healthy')
  return blockers
}

function postApplyBlockers(state: MigrationState): string[] {
  const blockers: string[] = []
  if (state.schemaIdentity !== ROOMS_STAGING_TARGET.schema) blockers.push('schema_identity_mismatch')
  if (state.appliedPayloadCount !== ROOMS_STAGING_REGISTERED_PAYLOAD_MIGRATIONS.length) blockers.push('applied_count_mismatch')
  if (state.missingPayloadMigrations.length > 0) blockers.push('pending_migrations_remain')
  if (state.unexpectedPayloadMigrations.length > 0) blockers.push('unexpected_payload_migrations')
  if (state.duplicatePayloadMigrations.length > 0) blockers.push('duplicate_payload_migrations')
  if (state.malformedPayloadCount > 0) blockers.push('malformed_payload_evidence')
  if (state.orderingAnomalyCount > 0) blockers.push('ordering_anomalies')
  if (!state.prismaHealthy) blockers.push('prisma_not_healthy')
  return blockers
}

function baseResult(
  authorization: RoomsStagingMigrationAuthorization,
  commit: string,
): RoomsStagingMigrationResult {
  return {
    version: 1,
    operation: 'apply-rooms-migration',
    ok: false,
    resultCode: 'blocked',
    environment: authorization.environment,
    targetId: authorization.targetId,
    schema: ROOMS_STAGING_TARGET.schema,
    commit,
    sourceTip: authorization.sourceTip,
    migration: ROOMS_STAGING_MIGRATION,
    blockers: [],
  }
}

export async function runRoomsStagingMigrationApply(
  databaseUrl: string | undefined,
  schemaOverride: string | undefined,
  authorization: RoomsStagingMigrationAuthorization,
  dependencies: RoomsStagingMigrationDependencies = {},
  output: (line: string) => void = () => {},
): Promise<RoomsStagingMigrationResult> {
  validateAuthorization(authorization)
  const expectedCommit = authorization.expectedCommit.toLowerCase()
  const { commit } = guardSourceAndWorktree(dependencies, expectedCommit, authorization.sourceTip)
  if (!databaseUrl) throw new Error('database_url_missing')
  guardDatabaseTarget(databaseUrl, authorization)

  const result = baseResult(authorization, commit)
  output('rooms-staging-migration source, target, approval, and rollback gates passed')

  let preStatus: MigrationState
  try {
    preStatus = await collectState(databaseUrl, schemaOverride, dependencies)
  } catch {
    result.blockers = ['pre_apply_status_query_failed']
    return result
  }
  result.preApply = evidence(preStatus)
  const preBlockers = preApplyBlockers(preStatus)
  if (preBlockers.length > 0) {
    result.blockers = preBlockers
    return result
  }

  output(`rooms-staging-migration applying ${ROOMS_STAGING_MIGRATION} with canonical Payload migrate command`)
  const commandResult = resolveCommandExecutor(dependencies)([...ROOMS_STAGING_PAYLOAD_MIGRATE_ARGS])
  const commandFailed = commandResult.error !== undefined || commandResult.status === null || commandResult.status !== 0
  if (commandFailed) {
    let uncertainStatus: MigrationState | null = null
    try {
      uncertainStatus = await collectState(databaseUrl, schemaOverride, dependencies)
    } catch {
      // The result remains uncertain and fail-closed when status cannot be read.
    }
    if (uncertainStatus) {
      result.postApply = evidence(uncertainStatus)
      result.targetMigrationApplied = postApplyBlockers(uncertainStatus).length === 0
    } else {
      result.targetMigrationApplied = null
    }
    result.resultCode = 'uncertain'
    result.targetMigrationApplied = result.targetMigrationApplied ?? null
    result.blockers = ['migration_command_outcome_uncertain']
    return result
  }

  let postStatus: MigrationState
  try {
    postStatus = await collectState(databaseUrl, schemaOverride, dependencies)
  } catch {
    result.blockers = ['post_apply_status_query_failed']
    return result
  }
  result.postApply = evidence(postStatus)
  const postBlockers = postApplyBlockers(postStatus)
  if (postBlockers.length > 0) {
    result.blockers = postBlockers
    return result
  }

  result.ok = true
  result.resultCode = 'applied'
  result.authorizationEvidence = {
    operatorId: authorization.operatorId,
    backupEvidenceId: authorization.backupEvidenceId,
    maintenanceWindowId: authorization.maintenanceWindowId,
    rollbackOwner: authorization.rollbackOwner,
  }
  output('rooms-staging-migration post-apply plan is clean')
  return result
}

export function parseRoomsStagingMigrationArgs(args: string[]): RoomsStagingMigrationAuthorization {
  const values: Partial<RoomsStagingMigrationAuthorization> = {}
  for (const arg of args) {
    const equals = arg.indexOf('=')
    if (equals < 0) throw new Error('argument_parse_failed')
    const key = arg.slice(0, equals)
    const value = arg.slice(equals + 1)
    if (!value) throw new Error('argument_parse_failed')
    const map: Record<string, keyof RoomsStagingMigrationAuthorization> = {
      '--operator-id': 'operatorId',
      '--backup-evidence-id': 'backupEvidenceId',
      '--maintenance-window-id': 'maintenanceWindowId',
      '--rollback-owner': 'rollbackOwner',
      '--expected-commit': 'expectedCommit',
      '--source-tip': 'sourceTip',
      '--environment': 'environment',
      '--target-id': 'targetId',
      '--expected-schema': 'expectedSchema',
      '--expected-hostname': 'expectedHostname',
      '--expected-database': 'expectedDatabase',
      '--expected-port': 'expectedPort',
      '--confirmation': 'confirmation',
      '--migration-approval': 'migrationApproval',
      '--rollback-readiness': 'rollbackReadiness',
    }
    const property = map[key]
    if (!property) throw new Error('argument_parse_failed')
    values[property] = value
  }
  for (const property of [
    'operatorId', 'backupEvidenceId', 'maintenanceWindowId', 'rollbackOwner', 'expectedCommit', 'sourceTip',
    'environment', 'targetId', 'expectedSchema', 'expectedHostname', 'expectedDatabase',
    'expectedPort', 'confirmation', 'migrationApproval', 'rollbackReadiness',
  ] as const) {
    if (!values[property]) throw new Error('argument_parse_failed')
  }
  return values as RoomsStagingMigrationAuthorization
}

function sanitizedFailure(authorization: Partial<RoomsStagingMigrationAuthorization>, blocker: string): RoomsStagingMigrationResult {
  return {
    version: 1,
    operation: 'apply-rooms-migration',
    ok: false,
    resultCode: 'blocked',
    environment: authorization.environment ?? '',
    targetId: authorization.targetId ?? '',
    schema: ROOMS_STAGING_TARGET.schema,
    commit: FULL_COMMIT_SHA_RE.test(authorization.expectedCommit ?? '') ? authorization.expectedCommit! : 'unknown',
    sourceTip: FULL_COMMIT_SHA_RE.test(authorization.sourceTip ?? '') ? authorization.sourceTip! : 'unknown',
    migration: ROOMS_STAGING_MIGRATION,
    blockers: [blocker],
  }
}

async function main(): Promise<void> {
  let authorization: RoomsStagingMigrationAuthorization
  try {
    authorization = parseRoomsStagingMigrationArgs(process.argv.slice(2))
  } catch {
    process.stdout.write(JSON.stringify(sanitizedFailure({}, 'argument_parse_failed')) + '\n')
    process.exitCode = 1
    return
  }

  try {
    const result = await runRoomsStagingMigrationApply(
      process.env.DATABASE_URL,
      process.env.PAYLOAD_MIGRATION_SCHEMA,
      authorization,
      {},
      (line) => process.stderr.write(`[rooms-staging-migration] ${line}\n`),
    )
    process.stdout.write(JSON.stringify(result) + '\n')
    process.exitCode = result.ok ? 0 : 1
  } catch (error) {
    const blocker = error instanceof Error && /^[a-z0-9_]+$/.test(error.message) ? error.message : 'guard_failed'
    process.stdout.write(JSON.stringify(sanitizedFailure(authorization, blocker)) + '\n')
    process.exitCode = 1
  }
}

if (require.main === module) {
  main().catch(() => {
    process.stdout.write(JSON.stringify(sanitizedFailure({}, 'guard_failed')) + '\n')
    process.exitCode = 1
  })
}
