import { execSync, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

import { ENVIRONMENT_TOPOLOGY, isAllowedStagingSourceRef } from '../../src/lib/environmentTopology'

export const ROOMS_STAGING_ROLLBACK_CONFIRMATION = 'prepare-rooms-staging-rollback-to-jpvbootcamp-staging' as const
export const ROOMS_STAGING_ROLLBACK_TARGET = {
  environment: 'staging',
  targetId: 'jpvbootcamp-staging',
  database: ENVIRONMENT_TOPOLOGY.staging.database,
  schema: ENVIRONMENT_TOPOLOGY.staging.schema,
  hostname: ENVIRONMENT_TOPOLOGY.staging.databaseHost,
  port: ENVIRONMENT_TOPOLOGY.staging.databasePort,
  backupHost: '100.71.47.24',
  backupUser: 'ubuntu',
  backupDirectory: '/var/backups/pgdump/jpvbootcamp_staging',
  backupService: 'clients-jpv-bootcamp-preview-wjfqfd',
  postgresImage: 'postgres:17-alpine',
} as const

const repoRoot = resolve(__dirname, '../../')
const FULL_COMMIT_SHA_RE = /^[0-9a-f]{40}$/
const SAFE_REFERENCE_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/
const SHA256_RE = /^[0-9a-f]{64}$/

type GitResolver = {
  branch: () => string
  commit: () => string
}

export type RoomsStagingRollbackPreparationDependencies = {
  gitResolver?: GitResolver
  gitStatusResolver?: () => string
  candidateAncestorResolver?: (candidate: string, sourceTip: string) => boolean
  remoteExecutor?: (args: string[], input: string) => {
    status: number | null
    stdout?: string
    error?: Error
  }
}

export type RoomsStagingRollbackPreparationAuthorization = {
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
  backupHost: string
  backupUser: string
  confirmation: string
}

export type RoomsStagingRollbackEvidence = {
  evidenceId: string
  location: string
  sha256: string
  bytes: number
  databaseIdentity: string
  restoreTest: 'passed'
}

export type RoomsStagingRollbackPreparationResult = {
  version: 1
  operation: 'prepare-rooms-staging-rollback'
  ok: boolean
  resultCode: 'prepared' | 'blocked' | 'uncertain'
  environment: string
  targetId: string
  schema: string
  commit: string
  sourceTip: string
  migration: '20260830_090000_member_portal_rooms'
  backup?: RoomsStagingRollbackEvidence
  blockers: string[]
}

function resolveGit(dependencies: RoomsStagingRollbackPreparationDependencies): GitResolver {
  if (dependencies.gitResolver) return dependencies.gitResolver
  return {
    branch: () => execSync('git rev-parse --abbrev-ref HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim(),
    commit: () => execSync('git rev-parse HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim(),
  }
}

function resolveGitStatus(dependencies: RoomsStagingRollbackPreparationDependencies): () => string {
  if (dependencies.gitStatusResolver) return dependencies.gitStatusResolver
  return () => execSync('git status --porcelain=v1 --untracked-files=all', { cwd: repoRoot, encoding: 'utf8' })
}

function isCandidateAncestor(
  candidate: string,
  sourceTip: string,
  dependencies: RoomsStagingRollbackPreparationDependencies,
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

function validateAuthorization(authorization: RoomsStagingRollbackPreparationAuthorization): void {
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
  if (authorization.environment !== ROOMS_STAGING_ROLLBACK_TARGET.environment) throw new Error('environment_not_staging')
  if (authorization.targetId !== ROOMS_STAGING_ROLLBACK_TARGET.targetId) throw new Error('target_id_not_staging')
  if (authorization.expectedSchema !== ROOMS_STAGING_ROLLBACK_TARGET.schema) throw new Error('schema_not_staging')
  if (authorization.expectedHostname !== ROOMS_STAGING_ROLLBACK_TARGET.hostname) throw new Error('hostname_not_staging')
  if (authorization.expectedDatabase !== ROOMS_STAGING_ROLLBACK_TARGET.database) throw new Error('database_not_staging')
  if (authorization.expectedPort !== ROOMS_STAGING_ROLLBACK_TARGET.port) throw new Error('port_not_staging')
  if (authorization.backupHost !== ROOMS_STAGING_ROLLBACK_TARGET.backupHost) throw new Error('backup_host_not_staging')
  if (authorization.backupUser !== ROOMS_STAGING_ROLLBACK_TARGET.backupUser) throw new Error('backup_user_not_allowed')
  if (authorization.confirmation !== ROOMS_STAGING_ROLLBACK_CONFIRMATION) throw new Error('confirmation_invalid')
}

function guardSourceAndWorktree(
  dependencies: RoomsStagingRollbackPreparationDependencies,
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

function remotePreparationScript(): string {
  return `set -eu
EVIDENCE_ID="$1"
EXPECTED_COMMIT="$2"
SOURCE_TIP="$3"
BACKUP_DIR="/var/backups/pgdump/jpvbootcamp_staging"
BACKUP_SERVICE="clients-jpv-bootcamp-preview-wjfqfd"
POSTGRES_IMAGE="postgres:17-alpine"
DESTINATION="$BACKUP_DIR/rooms-$EVIDENCE_ID.dump"

fail() {
  printf '{"version":1,"operation":"prepare-rooms-staging-rollback","ok":false,"resultCode":"blocked","environment":"staging","targetId":"jpvbootcamp-staging","schema":"jpvbootcamp","commit":"%s","sourceTip":"%s","migration":"20260830_090000_member_portal_rooms","blockers":["%s"]}\n' "$EXPECTED_COMMIT" "$SOURCE_TIP" "$1"
  exit 1
}

if ! printf '%s' "$EVIDENCE_ID" | grep -qE '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$'; then fail evidence_id_invalid; fi
if ! sudo -n test -d "$BACKUP_DIR"; then fail backup_directory_missing; fi
if [ "$(sudo -n stat -c '%a:%U:%G' "$BACKUP_DIR" 2>/dev/null || true)" != '700:root:root' ]; then fail backup_directory_not_protected; fi
if sudo -n test -e "$DESTINATION"; then fail backup_destination_exists; fi

DATABASE_URL="$(sudo -n docker service inspect "$BACKUP_SERVICE" --format '{{range .Spec.TaskTemplate.ContainerSpec.Env}}{{println .}}{{end}}' | awk -F= '$1 == "DATABASE_URL" { sub(/^[^=]*=/, ""); print; exit }')"
if [ -z "$DATABASE_URL" ]; then fail staging_database_url_missing; fi

IDENTITY="$(sudo -n docker run --rm --network host --env "DATABASE_URL=$DATABASE_URL" "$POSTGRES_IMAGE" sh -c 'psql "$DATABASE_URL" -Atqc "select current_database() || '\''|'\'' || current_schema() || '\''|'\'' || inet_server_addr()::text || '\''|'\'' || inet_server_port()::text"' 2>/dev/null || true)"
if [ "$IDENTITY" != 'jpvbootcamp_staging|jpvbootcamp|10.0.2.4|5433' ]; then fail staging_database_identity_mismatch; fi

TEMP_DUMP="$(mktemp /tmp/jpv-rooms-rollback.XXXXXX)"
RESTORE_NAME="jpv-rooms-restore-$EVIDENCE_ID"
cleanup() {
  rm -f "$TEMP_DUMP"
  sudo -n docker rm -f "$RESTORE_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

if ! sudo -n docker run --rm --network host --env "DATABASE_URL=$DATABASE_URL" "$POSTGRES_IMAGE" sh -c 'pg_dump --format=custom --no-owner --no-privileges --dbname="$DATABASE_URL"' > "$TEMP_DUMP" 2>/dev/null; then fail dump_command_failed; fi
if ! test -s "$TEMP_DUMP"; then fail dump_empty; fi
if ! sudo -n docker run --rm --network host --mount type=bind,src="$TEMP_DUMP",dst=/backup.dump,readonly "$POSTGRES_IMAGE" pg_restore --list /backup.dump >/dev/null 2>&1; then fail dump_integrity_failed; fi

CHECKSUM="$(sha256sum "$TEMP_DUMP" | awk '{print $1}')"
BYTES="$(wc -c < "$TEMP_DUMP" | tr -d ' ')"
if ! printf '%s' "$CHECKSUM" | grep -qE '^[0-9a-f]{64}$'; then fail checksum_failed; fi
if ! printf '%s' "$BYTES" | grep -qE '^[1-9][0-9]*$'; then fail byte_count_failed; fi
if ! sudo -n install -o root -g root -m 600 "$TEMP_DUMP" "$DESTINATION"; then fail backup_store_failed; fi
if [ "$(sudo -n sha256sum "$DESTINATION" | awk '{print $1}')" != "$CHECKSUM" ]; then fail stored_checksum_mismatch; fi

RESTORE_PASSWORD='rooms-restore-test-only'
if ! sudo -n docker run -d --rm --name "$RESTORE_NAME" -e "POSTGRES_PASSWORD=$RESTORE_PASSWORD" "$POSTGRES_IMAGE" >/dev/null; then fail restore_container_start_failed; fi
READY=0
for attempt in $(seq 1 30); do
  if sudo -n docker exec "$RESTORE_NAME" pg_isready -U postgres >/dev/null 2>&1; then READY=1; break; fi
  sleep 1
done
if [ "$READY" -ne 1 ]; then fail restore_target_unavailable; fi
if ! sudo -n docker run --rm --network "container:$RESTORE_NAME" --mount type=bind,src="$DESTINATION",dst=/backup.dump,readonly --env "PGPASSWORD=$RESTORE_PASSWORD" "$POSTGRES_IMAGE" sh -c 'pg_restore --exit-on-error --no-owner --no-privileges --dbname="postgresql://postgres:$PGPASSWORD@127.0.0.1:5432/postgres" /backup.dump' >/dev/null 2>&1; then fail restore_test_failed; fi

printf '{"version":1,"operation":"prepare-rooms-staging-rollback","ok":true,"resultCode":"prepared","environment":"staging","targetId":"jpvbootcamp-staging","schema":"jpvbootcamp","commit":"%s","sourceTip":"%s","migration":"20260830_090000_member_portal_rooms","backup":{"evidenceId":"%s","location":"%s","sha256":"%s","bytes":%s,"databaseIdentity":"%s","restoreTest":"passed"},"blockers":[]}\n' "$EXPECTED_COMMIT" "$SOURCE_TIP" "$EVIDENCE_ID" "$DESTINATION" "$CHECKSUM" "$BYTES" "$IDENTITY"
`
}

function defaultRemoteExecutor(
  authorization: RoomsStagingRollbackPreparationAuthorization,
  dependencies: RoomsStagingRollbackPreparationDependencies,
): { status: number | null; stdout?: string; error?: Error } {
  const args = [
    'ssh',
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=20',
    '-o', 'StrictHostKeyChecking=accept-new',
    `${authorization.backupUser}@${authorization.backupHost}`,
    'sh -s --',
    authorization.backupEvidenceId,
    authorization.expectedCommit.toLowerCase(),
    authorization.sourceTip.toLowerCase(),
  ]
  if (dependencies.remoteExecutor) return dependencies.remoteExecutor(args, remotePreparationScript())
  const result = spawnSync('ssh', args.slice(1), {
    cwd: repoRoot,
    input: remotePreparationScript(),
    encoding: 'utf8',
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe'],
    timeout: 300_000,
  })
  return {
    status: result.status,
    stdout: typeof result.stdout === 'string' ? result.stdout : undefined,
    error: result.error,
  }
}

function baseResult(
  authorization: RoomsStagingRollbackPreparationAuthorization,
  commit: string,
): RoomsStagingRollbackPreparationResult {
  return {
    version: 1,
    operation: 'prepare-rooms-staging-rollback',
    ok: false,
    resultCode: 'blocked',
    environment: authorization.environment,
    targetId: authorization.targetId,
    schema: authorization.expectedSchema,
    commit,
    sourceTip: authorization.sourceTip.toLowerCase(),
    migration: '20260830_090000_member_portal_rooms',
    blockers: [],
  }
}

function parseRemoteResult(
  stdout: string | undefined,
  authorization: RoomsStagingRollbackPreparationAuthorization,
): RoomsStagingRollbackPreparationResult | null {
  if (!stdout || /postgres(ql)?:\/\/|DATABASE_URL|PAYLOAD_SECRET|password\s*=|secret\s*=/i.test(stdout)) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout.trim())
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const result = parsed as Partial<RoomsStagingRollbackPreparationResult>
  if (
    result.version !== 1 ||
    result.operation !== 'prepare-rooms-staging-rollback' ||
    result.environment !== 'staging' ||
    result.targetId !== 'jpvbootcamp-staging' ||
    result.schema !== 'jpvbootcamp' ||
    result.commit !== authorization.expectedCommit.toLowerCase() ||
    result.sourceTip !== authorization.sourceTip.toLowerCase() ||
    result.migration !== '20260830_090000_member_portal_rooms' ||
    !Array.isArray(result.blockers)
  ) return null
  if (result.resultCode === 'blocked') {
    if (result.ok !== false || result.blockers.some((blocker) => typeof blocker !== 'string')) return null
    return result as RoomsStagingRollbackPreparationResult
  }
  if (result.resultCode !== 'prepared' || result.ok !== true || !result.backup) return null
  const backup = result.backup as Partial<RoomsStagingRollbackEvidence>
  if (
    backup.evidenceId !== authorization.backupEvidenceId ||
    backup.location !== `${ROOMS_STAGING_ROLLBACK_TARGET.backupDirectory}/rooms-${authorization.backupEvidenceId}.dump` ||
    typeof backup.sha256 !== 'string' ||
    !SHA256_RE.test(backup.sha256) ||
    typeof backup.bytes !== 'number' ||
    !Number.isSafeInteger(backup.bytes) ||
    backup.bytes <= 0 ||
    backup.databaseIdentity !== 'jpvbootcamp_staging|jpvbootcamp|10.0.2.4|5433' ||
    backup.restoreTest !== 'passed'
  ) return null
  return result as RoomsStagingRollbackPreparationResult
}

export function runRoomsStagingRollbackPreparation(
  authorization: RoomsStagingRollbackPreparationAuthorization,
  dependencies: RoomsStagingRollbackPreparationDependencies = {},
  output: (line: string) => void = () => {},
): RoomsStagingRollbackPreparationResult {
  validateAuthorization(authorization)
  const expectedCommit = authorization.expectedCommit.toLowerCase()
  const { commit } = guardSourceAndWorktree(dependencies, expectedCommit, authorization.sourceTip)
  const result = baseResult(authorization, commit)
  output('rooms-staging-rollback source, target, and protected-storage gates passed')

  const remote = defaultRemoteExecutor(authorization, dependencies)
  const remoteResult = parseRemoteResult(remote.stdout, authorization)
  if (remoteResult) {
    if (remoteResult.ok) output('rooms-staging-rollback dump integrity and disposable restore test passed')
    return remoteResult
  }
  result.resultCode = 'uncertain'
  result.blockers = ['backup_preparation_outcome_uncertain']
  return result
}

export function parseRoomsStagingRollbackPreparationArgs(
  args: string[],
): RoomsStagingRollbackPreparationAuthorization {
  const values: Partial<RoomsStagingRollbackPreparationAuthorization> = {}
  const map: Record<string, keyof RoomsStagingRollbackPreparationAuthorization> = {
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
    '--backup-host': 'backupHost',
    '--backup-user': 'backupUser',
    '--confirmation': 'confirmation',
  }
  for (const arg of args) {
    const equals = arg.indexOf('=')
    if (equals < 0) throw new Error('argument_parse_failed')
    const property = map[arg.slice(0, equals)]
    const value = arg.slice(equals + 1)
    if (!property || !value) throw new Error('argument_parse_failed')
    values[property] = value
  }
  for (const property of Object.values(map)) {
    if (!values[property]) throw new Error('argument_parse_failed')
  }
  return values as RoomsStagingRollbackPreparationAuthorization
}

function sanitizedFailure(
  authorization: Partial<RoomsStagingRollbackPreparationAuthorization>,
  blocker: string,
): RoomsStagingRollbackPreparationResult {
  return {
    version: 1,
    operation: 'prepare-rooms-staging-rollback',
    ok: false,
    resultCode: 'blocked',
    environment: authorization.environment ?? '',
    targetId: authorization.targetId ?? '',
    schema: authorization.expectedSchema ?? '',
    commit: FULL_COMMIT_SHA_RE.test(authorization.expectedCommit ?? '') ? authorization.expectedCommit! : 'unknown',
    sourceTip: FULL_COMMIT_SHA_RE.test(authorization.sourceTip ?? '') ? authorization.sourceTip! : 'unknown',
    migration: '20260830_090000_member_portal_rooms',
    blockers: [blocker],
  }
}

async function main(): Promise<void> {
  let authorization: RoomsStagingRollbackPreparationAuthorization
  try {
    authorization = parseRoomsStagingRollbackPreparationArgs(process.argv.slice(2))
  } catch {
    process.stdout.write(JSON.stringify(sanitizedFailure({}, 'argument_parse_failed')) + '\n')
    process.exitCode = 1
    return
  }

  try {
    const result = runRoomsStagingRollbackPreparation(
      authorization,
      {},
      (line) => process.stderr.write(`[rooms-staging-rollback] ${line}\\n`),
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

