import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

import { ENVIRONMENT_TOPOLOGY } from '../../src/lib/environmentTopology'
import {
  REGISTERED_PAYLOAD_MIGRATIONS,
  REGISTERED_PRISMA_MIGRATIONS,
} from './buildStagingMigrationStatus'
import {
  PRODUCTION_ROOMS_HISTORICAL_BASELINE_SHA256,
  PRODUCTION_ROOMS_PROTECTED_ORDERING_ANOMALIES,
} from './productionRoomsMigrationConstants'
import type { ProductionMigrationStatusReport } from './verifyProductionMigrationStatus'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../')
const remoteEntryPath = resolve(
  repoRoot,
  'scripts/release/productionMigrationStatusRemoteEntry.ts',
)
const esbuildPath = resolve(repoRoot, 'node_modules/.bin/esbuild')
const fullSha = /^[0-9a-f]{40}$/
const base64Payload = /^[A-Za-z0-9+/]+={0,2}$/

export const PRODUCTION_MIGRATION_PREFLIGHT_CONTROL = Object.freeze({
  controlBranch: 'codex/production-migration-preflight-20260907',
  candidateSha: '8b1f459fed358776fda791553ef225cc9f03b2ae',
  productionSha: 'f93ffac7dd299c39d8daf242d6a436272cc79188',
  origin: 'https://jpvbootcamp.com',
  dokployApplicationId: 'I_2Vukga3cc3ZhaG-mUzU',
  dokploySlug: 'clients-jpv-bootcamp-app-tp9xrk',
  image: 'ghcr.io/prochattools/jpv-bootcamp:f93ffac7dd299c39d8daf242d6a436272cc79188',
  dokployApiBase: 'https://dokploy.prochat.tools/api',
  databaseHost: '10.0.2.4',
  databasePort: '5433',
  database: 'jpvbootcamp',
  schema: 'jpvbootcamp',
  databaseRole: 'jpvbootcamp_production_app',
  migrationRegistryPaths: [
    'prisma/migrations',
    'src/migrations',
    'src/lib/payloadMigrationRegistry.ts',
  ],
  allowedControlFiles: [
    '.github/workflows/production-info-forum-migration.yml',
    'scripts/release/productionMigrationStatusControl.mts',
    'scripts/release/productionMigrationStatusControl.test.ts',
    'scripts/release/productionMigrationStatusRemoteEntry.ts',
  ],
})

const PRODUCTION = ENVIRONMENT_TOPOLOGY.production
type UnknownRecord = Record<string, unknown>

function required(name: string, environment: NodeJS.ProcessEnv = process.env): string {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`${name.toLowerCase()}_missing`)
  return value
}

function assertFullSha(value: string, name: string): string {
  if (!fullSha.test(value)) throw new Error(`${name}_invalid`)
  return value
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return {}
  }
}

function findDeploymentIds(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const child of value) findDeploymentIds(child, result)
  }
  if (isRecord(value)) {
    if (typeof value.deploymentId === 'string' && value.deploymentId) {
      result.add(value.deploymentId)
    }
    for (const child of Object.values(value)) findDeploymentIds(child, result)
  }
  return result
}

function findScheduleIdsByName(
  value: unknown,
  scheduleName: string,
  result = new Set<string>(),
): Set<string> {
  if (isRecord(value)) {
    if (value.name === scheduleName) {
      for (const key of ['scheduleId', 'id'] as const) {
        if (typeof value[key] === 'string' && value[key]) result.add(value[key])
      }
    }
    for (const child of Object.values(value)) {
      findScheduleIdsByName(child, scheduleName, result)
    }
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      findScheduleIdsByName(child, scheduleName, result)
    }
  }
  return result
}

function findScheduleIds(value: unknown, result = new Set<string>()): Set<string> {
  if (isRecord(value)) {
    if (typeof value.scheduleId === 'string' && value.scheduleId) {
      result.add(value.scheduleId)
    }
    for (const child of Object.values(value)) findScheduleIds(child, result)
  }
  if (Array.isArray(value)) {
    for (const child of value) findScheduleIds(child, result)
  }
  return result
}

function uniqueId(ids: Set<string>, ambiguousError: string): string | null {
  if (ids.size > 1) throw new Error(ambiguousError)
  return ids.values().next().value ?? null
}

function scheduleIdFromCreateResponse(value: unknown, scheduleName: string): string | null {
  const namedId = uniqueId(
    findScheduleIdsByName(value, scheduleName),
    'schedule_create_response_ambiguous',
  )
  if (namedId) return namedId

  const scheduleId = uniqueId(findScheduleIds(value), 'schedule_create_response_ambiguous')
  if (scheduleId) return scheduleId

  if (isRecord(value) && typeof value.id === 'string' && value.id) return value.id
  return null
}

function logText(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(logText).join('\n')
  if (isRecord(value)) return Object.values(value).map(logText).join('\n')
  return ''
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`
}

function currentCommit(): string {
  return execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim()
}

function commandSucceeded(command: string, args: string[]): boolean {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  })
  return result.status === 0
}

function exactChangedFiles(baseSha: string): string[] {
  const output = execFileSync('git', ['diff', '--name-only', baseSha, 'HEAD'], {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim()
  return output ? output.split('\n').filter(Boolean).sort() : []
}

function remoteControlBranchHead(): string {
  const output = execFileSync(
    'git',
    ['ls-remote', 'origin', `refs/heads/${PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.controlBranch}`],
    { cwd: repoRoot, encoding: 'utf8' },
  ).trim()
  const sha = output.split(/\s+/)[0] ?? ''
  return assertFullSha(sha, 'remote_control_branch_sha')
}

export function validateStaticProductionTargetContract(): void {
  if (
    PRODUCTION.origin !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.origin ||
    PRODUCTION.dokployApplicationId !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.dokployApplicationId ||
    PRODUCTION.dokploySlug !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.dokploySlug ||
    PRODUCTION.databaseHost !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.databaseHost ||
    PRODUCTION.databasePort !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.databasePort ||
    PRODUCTION.database !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.database ||
    PRODUCTION.schema !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.schema ||
    PRODUCTION.databaseRole !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.databaseRole
  ) {
    throw new Error('production_target_contract_mismatch')
  }
}

export function validateControlSourceBoundary(
  environment: NodeJS.ProcessEnv = process.env,
): void {
  validateStaticProductionTargetContract()
  const expectedSourceSha = assertFullSha(required('EXPECTED_SOURCE_SHA', environment), 'expected_source_sha')
  const expectedProductionSha = assertFullSha(
    required('EXPECTED_PRODUCTION_SHA', environment),
    'expected_production_sha',
  )
  const expectedCandidateSha = assertFullSha(
    required('EXPECTED_CANDIDATE_SHA', environment),
    'expected_candidate_sha',
  )

  if (environment.GITHUB_REF_NAME !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.controlBranch) {
    throw new Error('control_branch_mismatch')
  }
  if (environment.GITHUB_REF !== `refs/heads/${PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.controlBranch}`) {
    throw new Error('control_ref_mismatch')
  }
  if (currentCommit() !== expectedSourceSha) throw new Error('control_source_sha_mismatch')
  if (required('GITHUB_SHA', environment) !== expectedSourceSha) {
    throw new Error('workflow_source_sha_mismatch')
  }
  if (remoteControlBranchHead() !== expectedSourceSha) {
    throw new Error('remote_control_branch_moved')
  }
  if (expectedProductionSha !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.productionSha) {
    throw new Error('production_sha_mismatch')
  }
  if (expectedCandidateSha !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.candidateSha) {
    throw new Error('candidate_sha_mismatch')
  }
  if (
    !commandSucceeded('git', [
      'merge-base',
      '--is-ancestor',
      PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.candidateSha,
      expectedSourceSha,
    ])
  ) {
    throw new Error('candidate_not_ancestor_of_control')
  }

  const changedFiles = exactChangedFiles(PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.candidateSha)
  const allowedFiles = [...PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.allowedControlFiles].sort()
  if (JSON.stringify(changedFiles) !== JSON.stringify(allowedFiles)) {
    throw new Error('control_diff_scope_mismatch')
  }

  for (const registryPath of PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.migrationRegistryPaths) {
    if (
      !commandSucceeded('git', [
        'diff',
        '--quiet',
        PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.productionSha,
        PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.candidateSha,
        '--',
        registryPath,
      ])
    ) {
      throw new Error(`migration_registry_differs_from_serving_image:${registryPath}`)
    }
  }
}

export type PreflightRunIdentity = {
  scheduleName: string
  logMarker: string
}

export function buildPreflightRunIdentity(
  environment: NodeJS.ProcessEnv = process.env,
): PreflightRunIdentity {
  const runId = required('GITHUB_RUN_ID', environment)
  const runAttempt = required('GITHUB_RUN_ATTEMPT', environment)
  const sourceSha = assertFullSha(required('EXPECTED_SOURCE_SHA', environment), 'expected_source_sha')
  if (!/^[1-9][0-9]*$/.test(runId)) throw new Error('github_run_id_invalid')
  if (!/^[1-9][0-9]*$/.test(runAttempt)) throw new Error('github_run_attempt_invalid')

  const correlation = `${runId}-a${runAttempt}-${sourceSha.slice(0, 12)}`
  return {
    scheduleName: `jpv-production-migration-read-only-${correlation}`,
    logMarker: `JPV_PRODUCTION_MIGRATION_PREFLIGHT_RUN_${correlation}_START`,
  }
}

export function selectCorrelatedDeploymentId(
  baselineDeploymentIds: ReadonlySet<string>,
  runResponse: unknown,
  listedDeployments: unknown,
): string | null {
  const freshIds = new Set<string>()
  for (const source of [runResponse, listedDeployments]) {
    for (const deploymentId of findDeploymentIds(source)) {
      if (!baselineDeploymentIds.has(deploymentId)) freshIds.add(deploymentId)
    }
  }
  return uniqueId(freshIds, 'schedule_run_deployment_ambiguous')
}

export type RemoteVerifierBundle = {
  bytes: Buffer
  gzipBase64: string
  sha256: string
}

export function buildRemoteVerifierBundle(): RemoteVerifierBundle {
  const tempRoot = mkdtempSync(join(tmpdir(), 'jpv-production-migration-status-'))
  const outfile = join(tempRoot, 'production-migration-status.cjs')
  try {
    execFileSync(
      esbuildPath,
      [
        remoteEntryPath,
        '--bundle',
        '--platform=node',
        '--format=cjs',
        '--target=node20',
        '--external:pg',
        '--define:import.meta.dirname=__dirname',
        '--log-level=warning',
        `--outfile=${outfile}`,
      ],
      { cwd: repoRoot, stdio: 'pipe' },
    )
    const bytes = readFileSync(outfile)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const gzipBase64 = gzipSync(bytes, { level: 9 }).toString('base64')
    if (!base64Payload.test(gzipBase64)) throw new Error('remote_bundle_encoding_invalid')
    return { bytes, gzipBase64, sha256 }
  } finally {
    rmSync(tempRoot, { recursive: true, force: true })
  }
}

function sameMembers(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length &&
    JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort())
  )
}

function stringArray(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? (value as string[])
    : null
}

export function validateProductionMigrationStatusReport(
  value: unknown,
): ProductionMigrationStatusReport {
  if (!isRecord(value)) throw new Error('migration_status_report_invalid')
  const report = value as unknown as ProductionMigrationStatusReport
  const payload = report.migrationLedger?.payload
  const prisma = report.migrationLedger?.prisma
  const deployedRevision = report.deployedRevision
  const rollbackReadiness = report.rollbackReadiness
  if (!payload || !prisma || !deployedRevision || !rollbackReadiness) {
    throw new Error('migration_status_report_incomplete')
  }

  if (report.result !== 'VERIFIED' || report.mode !== 'production-read-only') {
    throw new Error('migration_status_not_verified')
  }
  if (
    report.target.origin !== PRODUCTION.origin ||
    report.target.database !== PRODUCTION.database ||
    report.target.schema !== PRODUCTION.schema ||
    report.target.role !== PRODUCTION.databaseRole
  ) {
    throw new Error('migration_status_target_mismatch')
  }
  if (
    deployedRevision.expectedSha !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.productionSha ||
    deployedRevision.observedCommitSha !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.productionSha ||
    deployedRevision.observedImageTag !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.productionSha
  ) {
    throw new Error('migration_status_revision_mismatch')
  }

  const payloadExpected = stringArray(payload.expected)
  const payloadApplied = stringArray(payload.applied)
  const payloadPending = stringArray(payload.pending)
  const payloadUnexpected = stringArray(payload.unexpected)
  const payloadDuplicate = stringArray(payload.duplicate)
  if (
    !payloadExpected ||
    !payloadApplied ||
    !payloadPending ||
    !payloadUnexpected ||
    !payloadDuplicate ||
    !sameMembers(payloadExpected, REGISTERED_PAYLOAD_MIGRATIONS) ||
    !sameMembers(payloadApplied, REGISTERED_PAYLOAD_MIGRATIONS) ||
    payloadPending.length !== 0 ||
    payloadUnexpected.length !== 0 ||
    payloadDuplicate.length !== 0 ||
    payload.malformedRows !== 0 ||
    JSON.stringify(payload.orderingAnomalies) !==
      JSON.stringify(PRODUCTION_ROOMS_PROTECTED_ORDERING_ANOMALIES) ||
    payload.historicalBaseline.expectedSha256 !== PRODUCTION_ROOMS_HISTORICAL_BASELINE_SHA256 ||
    payload.historicalBaseline.observedSha256 !== PRODUCTION_ROOMS_HISTORICAL_BASELINE_SHA256 ||
    payload.historicalBaseline.matches !== true
  ) {
    throw new Error('payload_migration_status_mismatch')
  }

  const prismaExpected = stringArray(prisma.expected)
  const prismaPending = stringArray(prisma.pending)
  const prismaUnexpected = stringArray(prisma.unexpected)
  const prismaDuplicate = stringArray(prisma.duplicate)
  const prismaStatusNames = Array.isArray(prisma.statuses)
    ? prisma.statuses.map((entry) => entry?.name)
    : []
  if (
    !prismaExpected ||
    !prismaPending ||
    !prismaUnexpected ||
    !prismaDuplicate ||
    !sameMembers(prismaExpected, REGISTERED_PRISMA_MIGRATIONS) ||
    !sameMembers(prismaStatusNames, REGISTERED_PRISMA_MIGRATIONS) ||
    prismaPending.length !== 0 ||
    prismaUnexpected.length !== 0 ||
    prismaDuplicate.length !== 0 ||
    prisma.statuses.some((entry) => entry.status !== 'applied')
  ) {
    throw new Error('prisma_migration_status_mismatch')
  }

  if (
    rollbackReadiness.mutationPerformed !== false ||
    rollbackReadiness.readOnlyTransaction !== true ||
    rollbackReadiness.action !== 'none' ||
    report.blockers.length !== 0
  ) {
    throw new Error('migration_status_read_only_contract_mismatch')
  }
  return report
}

export function buildServerScript(bundle: RemoteVerifierBundle, logMarker: string): string {
  if (!/^JPV_PRODUCTION_MIGRATION_PREFLIGHT_RUN_[0-9]+-a[0-9]+-[0-9a-f]{12}_START$/.test(logMarker)) {
    throw new Error('preflight_log_marker_invalid')
  }
  const compressedPayload = shellQuote(bundle.gzipBase64)
  const expectedImage = PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.image
  const expectedSha = PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.productionSha
  const expectedSlug = PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.dokploySlug
  const containerSelector = `container_ids="$(docker ps --format '{{.ID}} {{.Names}} {{.Image}}' | awk '$3 == "${expectedImage}" && index($2, "${expectedSlug}") == 1 {print $1}')"`

  return [
    'set -eu',
    `expected_image=${shellQuote(expectedImage)}`,
    `bundle_b64=${compressedPayload}`,
    `bundle_sha=${shellQuote(bundle.sha256)}`,
    containerSelector,
    `container_count="$(printf '%s\\n' "$container_ids" | awk 'NF {count += 1} END {print count + 0}')"`,
    'test "$container_count" -eq 1',
    `container_id="$(printf '%s\\n' "$container_ids" | awk 'NF {print; exit}')"`,
    'test -n "$container_id"',
    'test "$(docker inspect --format \'{{.Config.Image}}\' "$container_id")" = "$expected_image"',
    `printf '${logMarker}\\n'`,
    `observed_bundle_sha="$(printf '%s' "$bundle_b64" | base64 -d | gzip -dc | docker exec -i "$container_id" sha256sum | awk '{print $1}')"`,
    'test "$observed_bundle_sha" = "$bundle_sha"',
    'set +e',
    `remote_output="$(printf '%s' "$bundle_b64" | base64 -d | gzip -dc | docker exec -i -w /app/scripts/release -e DEPLOYMENT_ENV=production -e EXPECTED_DEPLOYMENT_SHA=${shellQuote(expectedSha)} -e NODE_PATH=/script-deps/node_modules "$container_id" node - --mode=production-read-only --expected-schema=jpvbootcamp --acknowledge-read-only 2>&1)"`,
    'runner_status=$?',
    'set -e',
    "printf '%s\\n' \"$remote_output\"",
    "printf 'JPV_PRODUCTION_MIGRATION_PREFLIGHT_REMOTE_EXIT_%s\\n' \"$runner_status\"",
    'exit "$runner_status"',
  ].join('\n')
}

async function dokployRequest(
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<{ status: number; data: unknown }> {
  const response = await fetch(`${PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.dokployApiBase}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      ...(init?.headers ?? {}),
    },
    signal: AbortSignal.timeout(30_000),
  })
  return { status: response.status, data: readJson(await response.text()) }
}

async function assertDokployApplicationTarget(apiKey: string): Promise<void> {
  const applicationQuery = new URLSearchParams({
    applicationId: PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.dokployApplicationId,
  })
  const application = await dokployRequest(
    apiKey,
    `/application.one?${applicationQuery.toString()}`,
  )
  if (application.status < 200 || application.status >= 300 || !isRecord(application.data)) {
    throw new Error('production_application_lookup_failed')
  }
  if (
    application.data.applicationId !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.dokployApplicationId ||
    application.data.dockerImage !== PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.image
  ) {
    throw new Error('production_application_target_mismatch')
  }
}

async function listScheduleIdByName(apiKey: string, scheduleName: string): Promise<string | null> {
  const listed = await dokployRequest(
    apiKey,
    `/schedule.list?id=${encodeURIComponent(PRODUCTION_MIGRATION_PREFLIGHT_CONTROL.dokployApplicationId)}&scheduleType=dokploy-server`,
  )
  if (listed.status < 200 || listed.status >= 300) throw new Error('schedule_list_failed')
  return uniqueId(findScheduleIdsByName(listed.data, scheduleName), 'schedule_name_ambiguous')
}

async function runReadOnlySchedule(bundle: RemoteVerifierBundle): Promise<void> {
  const apiKey = required('DOKPLOY_API_KEY')
  await assertDokployApplicationTarget(apiKey)
  const { scheduleName, logMarker } = buildPreflightRunIdentity()
  const serverScript = buildServerScript(bundle, logMarker)
  const created = await dokployRequest(apiKey, '/schedule.create', {
    method: 'POST',
    body: JSON.stringify({
      name: scheduleName,
      description: 'Disposable read-only production migration-status preflight',
      cronExpression: '0 0 1 1 *',
      command: 'true',
      script: serverScript,
      shellType: 'sh',
      scheduleType: 'dokploy-server',
      appName: scheduleName,
      enabled: false,
    }),
  })
  if (created.status < 200 || created.status >= 300) throw new Error('schedule_create_failed')
  let scheduleId = scheduleIdFromCreateResponse(created.data, scheduleName)

  try {
    if (!scheduleId) {
      scheduleId = await listScheduleIdByName(apiKey, scheduleName)
    }
    if (!scheduleId) throw new Error('schedule_id_missing')

    const baselineDeployments = await dokployRequest(
      apiKey,
      `/deployment.allByType?id=${encodeURIComponent(scheduleId)}&type=schedule`,
    )
    if (baselineDeployments.status < 200 || baselineDeployments.status >= 300) {
      throw new Error('schedule_deployment_baseline_failed')
    }
    const baselineDeploymentIds = findDeploymentIds(baselineDeployments.data)

    const run = await dokployRequest(apiKey, '/schedule.runManually', {
      method: 'POST',
      body: JSON.stringify({ scheduleId }),
    })
    if (run.status < 200 || run.status >= 300) throw new Error('schedule_run_failed')

    for (let attempt = 1; attempt <= 36; attempt += 1) {
      const deployments = await dokployRequest(
        apiKey,
        `/deployment.allByType?id=${encodeURIComponent(scheduleId)}&type=schedule`,
      )
      if (deployments.status < 200 || deployments.status >= 300) {
        throw new Error('schedule_deployment_lookup_failed')
      }
      const deploymentId = selectCorrelatedDeploymentId(
        baselineDeploymentIds,
        run.data,
        deployments.data,
      )
      if (deploymentId) {
        const logs = await dokployRequest(
          apiKey,
          `/deployment.readLogs?deploymentId=${encodeURIComponent(deploymentId)}&tail=10000`,
        )
        if (logs.status < 200 || logs.status >= 300) {
          throw new Error('schedule_deployment_log_read_failed')
        }
        const text = logText(logs.data)
        if (!text.includes(logMarker)) {
          if (attempt < 36) {
            await new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000))
            continue
          }
          throw new Error('schedule_run_correlation_marker_missing')
        }
        const resultMatch = text.match(
          /JPV_PRODUCTION_MIGRATION_STATUS_RESULT_B64=([A-Za-z0-9+/=]+)/,
        )
        const exitMatch = text.match(/JPV_PRODUCTION_MIGRATION_PREFLIGHT_REMOTE_EXIT_(\d+)/)
        if (exitMatch && Number.parseInt(exitMatch[1], 10) !== 0) {
          throw new Error('remote_read_only_verifier_failed')
        }
        if (resultMatch && exitMatch) {
          const decoded = Buffer.from(resultMatch[1], 'base64').toString('utf8')
          const report = validateProductionMigrationStatusReport(JSON.parse(decoded) as unknown)
          process.stdout.write(`${JSON.stringify(report)}\n`)
          return
        }
      }
      if (attempt < 36) await new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000))
    }
    throw new Error('schedule_completion_marker_missing')
  } finally {
    if (!scheduleId) {
      scheduleId = await listScheduleIdByName(apiKey, scheduleName)
    }
    if (scheduleId) {
      const deleted = await dokployRequest(apiKey, '/schedule.delete', {
        method: 'POST',
        body: JSON.stringify({ scheduleId }),
      })
      if (deleted.status < 200 || deleted.status >= 300) throw new Error('schedule_cleanup_failed')
    } else {
      throw new Error('schedule_cleanup_target_missing')
    }
  }
}

async function main(): Promise<void> {
  validateControlSourceBoundary()
  const bundle = buildRemoteVerifierBundle()
  await runReadOnlySchedule(bundle)
}

const invokedPath = process.argv[1]
if (invokedPath && resolve(invokedPath) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'production_migration_status_control_failed')
    process.exitCode = 1
  })
}
