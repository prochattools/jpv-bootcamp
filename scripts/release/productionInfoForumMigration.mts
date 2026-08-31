import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import {
  INFO_FORUM_PRODUCTION_CONFIRMATION,
  INFO_FORUM_TARGET,
  type InfoForumMigrationMode,
} from './productionInfoForumMigrationConstants'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../')
const runnerPath = resolve(repoRoot, 'scripts/release/productionInfoForumMigrationRunner.mjs')
const fullSha = /^[0-9a-f]{40}$/
const sha256 = /^[0-9a-f]{64}$/
const safeReference = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

type UnknownRecord = Record<string, unknown>

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name.toLowerCase()}_missing`)
  return value
}

function assertSha(value: string, name: string): string {
  if (!fullSha.test(value)) throw new Error(`${name}_invalid`)
  return value
}

function assertSha256(value: string, name: string): string {
  if (!sha256.test(value)) throw new Error(`${name}_invalid`)
  return value
}

function assertReference(value: string, name: string): string {
  if (!safeReference.test(value)) throw new Error(`${name}_invalid`)
  return value
}

function readJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return {}
  }
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function findString(value: unknown, keys: string[]): string | null {
  if (isRecord(value)) {
    for (const key of keys) if (typeof value[key] === 'string' && value[key]) return value[key] as string
    for (const child of Object.values(value)) {
      const found = findString(child, keys)
      if (found) return found
    }
  }
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findString(child, keys)
      if (found) return found
    }
  }
  return null
}

function findDeploymentIds(value: unknown, result = new Set<string>()): Set<string> {
  if (Array.isArray(value)) for (const child of value) findDeploymentIds(child, result)
  if (isRecord(value)) {
    if (typeof value.deploymentId === 'string' && value.deploymentId) result.add(value.deploymentId)
    for (const child of Object.values(value)) findDeploymentIds(child, result)
  }
  return result
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
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
}

function mode(): InfoForumMigrationMode {
  const value = required('INFO_FORUM_MIGRATION_MODE')
  if (value !== 'plan' && value !== 'apply') throw new Error('migration_mode_invalid')
  return value
}

function validateInputs(requestedMode: InfoForumMigrationMode): void {
  const expectedSourceSha = assertSha(required('EXPECTED_SOURCE_SHA'), 'expected_source_sha')
  const expectedProductionSha = assertSha(required('EXPECTED_PRODUCTION_SHA'), 'expected_production_sha')
  if (currentCommit() !== expectedSourceSha) throw new Error('source_sha_mismatch')
  if (process.env.GITHUB_REF_NAME !== 'main') throw new Error('main_source_ref_required')
  if (requestedMode === 'apply') {
    if (required('CONFIRMATION') !== INFO_FORUM_PRODUCTION_CONFIRMATION) throw new Error('confirmation_invalid')
    if (expectedSourceSha !== expectedProductionSha) throw new Error('source_must_equal_deployed_sha')
    if (required('LIVE_DRY_RUN_PASSED') !== 'true') throw new Error('live_dry_run_attestation_required')
    assertReference(required('BACKUP_EVIDENCE_ID'), 'backup_evidence_id')
    assertSha256(required('BACKUP_SHA256'), 'backup_sha256')
    assertReference(required('REHEARSAL_EVIDENCE_ID'), 'rehearsal_evidence_id')
    assertReference(required('OPERATOR_ID'), 'operator_id')
    assertReference(required('ROLLBACK_OWNER'), 'rollback_owner')
    assertReference(required('OPERATION_ID'), 'operation_id')
    assertReference(required('EXPECTED_SOURCE_ID'), 'expected_source_id')
    assertReference(required('EXPECTED_SOURCE_SLUG'), 'expected_source_slug')
    assertReference(required('EXPECTED_DESTINATION_ID'), 'expected_destination_id')
    assertSha256(required('EXPECTED_PLAN_FINGERPRINT'), 'expected_plan_fingerprint')
  }
}

async function dokployRequest(apiBase: string, apiKey: string, path: string, init?: RequestInit): Promise<{ status: number; data: unknown }> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
  })
  return { status: response.status, data: readJson(await response.text()) }
}

function buildRemoteCommand(requestedMode: InfoForumMigrationMode, expectedSha: string): string {
  const runner = '/app/scripts/release/productionInfoForumMigrationRunner.mjs'
  const variables: Record<string, string> = {
    INFO_FORUM_MIGRATION_MODE: requestedMode,
    INFO_FORUM_MIGRATION_TARGET: 'production',
    EXPECTED_DEPLOYMENT_SHA: expectedSha,
    TARGET_ORIGIN: INFO_FORUM_TARGET.origin,
    DOKPLOY_APPLICATION_ID: INFO_FORUM_TARGET.dokployApplicationId,
    DOKPLOY_APPLICATION_NAME: INFO_FORUM_TARGET.dokploySlug,
    INFO_FORUM_SOURCE_ID: process.env.INFO_FORUM_SOURCE_ID ?? process.env.EXPECTED_SOURCE_ID ?? '',
    INFO_FORUM_SOURCE_SLUG: process.env.INFO_FORUM_SOURCE_SLUG ?? process.env.EXPECTED_SOURCE_SLUG ?? '',
    INFO_FORUM_DESTINATION_ID: process.env.INFO_FORUM_DESTINATION_ID ?? process.env.EXPECTED_DESTINATION_ID ?? '',
  }
  for (const name of ['INFO_FORUM_SOURCE_ID', 'INFO_FORUM_DESTINATION_ID']) {
    if (!variables[name]) throw new Error(`${name.toLowerCase()}_missing`)
  }
  if (requestedMode === 'apply') {
    variables.INFO_FORUM_MAIN_SHA = expectedSha
    variables.INFO_FORUM_EXPECTED_RELEASE_SHA = expectedSha
    for (const name of ['INFO_FORUM_PRODUCTION_CONFIRMATION', 'INFO_FORUM_LIVE_DRY_RUN_PASSED', 'INFO_FORUM_MAIN_SHA', 'INFO_FORUM_EXPECTED_RELEASE_SHA', 'INFO_FORUM_BACKUP_EVIDENCE_ID', 'INFO_FORUM_BACKUP_SHA256', 'INFO_FORUM_REHEARSAL_EVIDENCE_ID', 'INFO_FORUM_OPERATION_ID', 'INFO_FORUM_EXPECTED_SOURCE_ID', 'INFO_FORUM_EXPECTED_SOURCE_SLUG', 'INFO_FORUM_EXPECTED_DESTINATION_ID', 'INFO_FORUM_EXPECTED_PLAN_FINGERPRINT']) {
      const sourceName = name === 'INFO_FORUM_PRODUCTION_CONFIRMATION' ? 'CONFIRMATION' : name.replace(/^INFO_FORUM_/, '')
      const value = variables[name] ?? process.env[name] ?? process.env[sourceName]
      if (!value) throw new Error(`${name.toLowerCase()}_missing`)
      variables[name] = value
    }
  }
  const assignments = Object.entries(variables).map(([name, value]) => `${name}=${shellQuote(value)}`).join(' ')
  const runnerSha = execFileSync('shasum', ['-a', '256', runner], { cwd: repoRoot, encoding: 'utf8' }).split(/\s+/)[0]
  return [
    'set -u',
    "printf 'JPV_INFO_FORUM_REMOTE_START\\n'",
    `test -f "${runner}"`,
    `test "$(sha256sum "${runner}" | awk '{print $1}')" = '${runnerSha}'`,
    `set +e; ${assignments} node "${runner}"; runner_status=$?; printf 'JPV_INFO_FORUM_REMOTE_EXIT_%s\\n' "$runner_status"; exit "$runner_status"`,
  ].join('; ')
}

async function runSchedule(requestedMode: InfoForumMigrationMode): Promise<void> {
  const apiKey = required('DOKPLOY_API_KEY')
  const apiBase = (process.env.DOKPLOY_API_BASE_URL?.trim() || 'https://dokploy.prochat.tools/api').replace(/\/$/, '')
  const expectedSha = assertSha(required('EXPECTED_PRODUCTION_SHA'), 'expected_production_sha')
  const scheduleName = `jpv-info-forum-${requestedMode}-${process.env.GITHUB_RUN_ID ?? Date.now()}`
  const command = buildRemoteCommand(requestedMode, expectedSha)
  const serverScript = [
    'set -u',
    `container_id="$(docker ps --format '{{.ID}} {{.Names}} {{.Image}}' | grep -F '${INFO_FORUM_TARGET.dokploySlug}' | grep -F 'ghcr.io/prochattools/jpv-bootcamp:${expectedSha}' | sed -n '1s/ .*//p')"`,
    'test -n "$container_id"',
    `docker exec "$container_id" sh -c ${shellQuote(command)}`,
  ].join('\n')
  const created = await dokployRequest(apiBase, apiKey, '/schedule.create', {
    method: 'POST',
    body: JSON.stringify({ name: scheduleName, description: `One-off guarded Info Forum consolidation ${requestedMode}`, cronExpression: '0 0 1 1 *', command: 'true', script: serverScript, shellType: 'sh', scheduleType: 'dokploy-server', appName: scheduleName, enabled: false }),
  })
  if (created.status < 200 || created.status >= 300) throw new Error('schedule_create_failed')
  const scheduleId = findString(created.data, ['scheduleId', 'id'])
  if (!scheduleId) throw new Error('schedule_id_missing')
  try {
    const run = await dokployRequest(apiBase, apiKey, '/schedule.runManually', { method: 'POST', body: JSON.stringify({ scheduleId }) })
    if (run.status < 200 || run.status >= 300) throw new Error('schedule_run_failed')
    for (let attempt = 1; attempt <= 36; attempt += 1) {
      const deployments = await dokployRequest(apiBase, apiKey, `/deployment.allByType?id=${encodeURIComponent(scheduleId)}&type=schedule`)
      const deploymentIds = [...findDeploymentIds(deployments.data)]
      for (const deploymentId of deploymentIds) {
        const logs = await dokployRequest(apiBase, apiKey, `/deployment.readLogs?deploymentId=${encodeURIComponent(deploymentId)}&tail=10000`)
        const text = logText(logs.data)
        const marker = text.match(/(?:^|\n)(\{\"version\":1,.*)$/m)
        if (marker) {
          const result = JSON.parse(marker[1]) as UnknownRecord
          process.stdout.write(`${JSON.stringify(result)}\n`)
          if (result.ok !== true) throw new Error('info_forum_migration_blocked')
          return
        }
        if (/JPV_INFO_FORUM_REMOTE_EXIT_[1-9]\d*/.test(text)) throw new Error('remote_runner_failed')
      }
      if (attempt < 36) await new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000))
    }
    throw new Error('schedule_completion_marker_missing')
  } finally {
    const deleted = await dokployRequest(apiBase, apiKey, '/schedule.delete', { method: 'POST', body: JSON.stringify({ scheduleId }) })
    if (deleted.status < 200 || deleted.status >= 300) throw new Error('schedule_cleanup_failed')
  }
}

async function main(): Promise<void> {
  const requestedMode = mode()
  validateInputs(requestedMode)
  await runSchedule(requestedMode)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'production_info_forum_control_failed')
  process.exitCode = 1
})
