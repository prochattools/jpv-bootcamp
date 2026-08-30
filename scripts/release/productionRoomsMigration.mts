import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

import { PAYLOAD_MIGRATION_NAMES } from '../../src/lib/payloadMigrationRegistry'
import {
	PRODUCTION_ROOMS_BACKUP_EVIDENCE_ID,
	PRODUCTION_ROOMS_BACKUP_SHA256,
	PRODUCTION_ROOMS_CRITICAL_TABLES,
	PRODUCTION_ROOMS_HISTORICAL_BASELINE_SHA256,
	PRODUCTION_ROOMS_MIGRATION,
	PRODUCTION_ROOMS_MIGRATION_APPLY_CONFIRMATION,
	PRODUCTION_ROOMS_MIGRATION_PLAN_CONFIRMATION,
	PRODUCTION_ROOMS_MIGRATION_SOURCE_SHA256,
	PRODUCTION_ROOMS_NAV_FINALIZE_CONFIRMATION,
	PRODUCTION_ROOMS_REHEARSAL_CONFIRMATION,
	PRODUCTION_ROOMS_TARGET,
	type ProductionRoomsMigrationMode,
} from './productionRoomsMigrationConstants'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../')
const migrationPath = resolve(repoRoot, 'src/migrations/20260830_090000_member_portal_rooms.ts')
const runnerPath = resolve(repoRoot, 'scripts/release/productionRoomsMigrationRunner.mjs')
const fullSha = /^[0-9a-f]{40}$/
const sha256 = /^[0-9a-f]{64}$/
const safeReference = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/

type UnknownRecord = Record<string, unknown>

export type ProductionRoomsControlPayload = {
	version: 1
	target: 'production' | 'rehearsal'
	mode: ProductionRoomsMigrationMode
	migration: typeof PRODUCTION_ROOMS_MIGRATION
	sourceSha256: string
	migrationSql: string
	migrationSqlSha256: string
	historicalBaselineSha256: string
	registeredPayloadMigrations: string[]
	registeredPrismaMigrations: string[]
	targetOrigin: string
	applicationId: string
	applicationName: string
	operatorId?: string
	backupEvidenceId?: string
	backupSha256?: string
	rehearsalEvidenceId?: string
	rollbackOwner?: string
	maintenanceWindowId?: string
}

export type ProductionRoomsControlResult = {
	resultCode: string
	ok: boolean
	[key: string]: unknown
}

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

function fileSha256(path: string): string {
	return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/**
 * Extract the exact SQL template used by the immutable migration's `up`
 * function. This keeps the production bridge from maintaining a second copy
 * of the historical migration operations.
 */
export function extractRoomsMigrationUpSql(source = readFileSync(migrationPath, 'utf8')): string {
	const startMarker = 'await db.execute(sql.raw(`'
	const start = source.indexOf(startMarker)
	if (start < 0) throw new Error('migration_up_sql_marker_missing')
	const sqlStart = start + startMarker.length
	const sqlEnd = source.indexOf('`))', sqlStart)
	if (sqlEnd < 0) throw new Error('migration_up_sql_end_missing')
	const template = source.slice(sqlStart, sqlEnd)
	if (!template.trim() || template.includes('`')) throw new Error('migration_up_sql_invalid')
	const sql = template.replaceAll('${schema}', '"jpvbootcamp"')
	if (sql.includes('${schema}')) throw new Error('migration_up_sql_schema_unresolved')
	if (/\b(?:DROP\s+TABLE|DROP\s+COLUMN|DROP\s+TYPE|DELETE\s+FROM|TRUNCATE|DROP\s+DATABASE)\b/i.test(sql)) {
		throw new Error('migration_up_sql_destructive_operation')
	}
	return sql
}

function registeredPrismaMigrations(): string[] {
	return readdirSync(resolve(repoRoot, 'prisma/migrations'), { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort()
}

export function validateImmutableRoomsMigration(): { sourceSha256: string; migrationSql: string; migrationSqlSha256: string } {
	const sourceSha256 = fileSha256(migrationPath)
	if (sourceSha256 !== PRODUCTION_ROOMS_MIGRATION_SOURCE_SHA256) throw new Error('migration_source_checksum_mismatch')
	const migrationSql = extractRoomsMigrationUpSql()
	const migrationSqlSha256 = createHash('sha256').update(migrationSql).digest('hex')
	return { sourceSha256, migrationSql, migrationSqlSha256 }
}

export function buildMigrationPayload(
	mode: ProductionRoomsMigrationMode,
	target: 'production' | 'rehearsal',
	metadata: Partial<Pick<ProductionRoomsControlPayload, 'operatorId' | 'backupEvidenceId' | 'backupSha256' | 'rehearsalEvidenceId' | 'rollbackOwner' | 'maintenanceWindowId'>> = {},
): ProductionRoomsControlPayload {
	const migration = validateImmutableRoomsMigration()
	return {
		version: 1,
		target,
		mode,
		migration: PRODUCTION_ROOMS_MIGRATION,
		sourceSha256: migration.sourceSha256,
		migrationSql: migration.migrationSql,
		migrationSqlSha256: migration.migrationSqlSha256,
		historicalBaselineSha256: PRODUCTION_ROOMS_HISTORICAL_BASELINE_SHA256,
		registeredPayloadMigrations: [...PAYLOAD_MIGRATION_NAMES],
		registeredPrismaMigrations: registeredPrismaMigrations(),
		targetOrigin: PRODUCTION_ROOMS_TARGET.origin,
		applicationId: PRODUCTION_ROOMS_TARGET.dokployApplicationId,
		applicationName: PRODUCTION_ROOMS_TARGET.dokploySlug,
		...metadata,
	}
}

function encoded(value: unknown): string {
	return gzipSync(Buffer.from(JSON.stringify(value), 'utf8')).toString('base64')
}

export function buildRemoteScheduleCommand(
	payload: ProductionRoomsControlPayload,
	commandId = `${payload.mode}-${process.env.GITHUB_RUN_ID ?? 'local'}`,
): string {
	assertReference(commandId, 'command_id')
	const runner = gzipSync(readFileSync(runnerPath)).toString('base64')
	const payloadData = encoded(payload)
	const temporaryRunnerPath = `/tmp/jpv-rooms-${commandId}.mjs`
	return [
		'set -eu; printf \'JPV_ROOMS_REMOTE_START\\n\'',
		`node -e 'require("fs").writeFileSync("${temporaryRunnerPath}", require("zlib").gunzipSync(Buffer.from("${runner}", "base64")))'`,
		`trap 'rm -f "${temporaryRunnerPath}"' EXIT`,
		`ROOMS_MIGRATION_TARGET=production ROOMS_MIGRATION_EXPECTED_RELEASE_SHA='${requiredPayloadReleaseSha(payload)}' EXPECTED_DEPLOYMENT_SHA='${requiredPayloadReleaseSha(payload)}' ROOMS_MIGRATION_PAYLOAD_B64='${payloadData}' node "${temporaryRunnerPath}"`,
	].join('; ')
}

function requiredPayloadReleaseSha(payload: ProductionRoomsControlPayload): string {
	return assertSha(required('EXPECTED_PRODUCTION_SHA'), 'expected_production_sha')
}

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readJson(response: Response): Promise<unknown> {
	const body = await response.text()
	if (!body.trim()) return {}
	try {
		return JSON.parse(body) as unknown
	} catch {
		return {}
	}
}

async function dokployRequest(
	apiBase: string,
	apiKey: string,
	path: string,
	init?: RequestInit,
): Promise<{ status: number; data: unknown }> {
	const response = await fetch(`${apiBase}${path}`, {
		...init,
		headers: {
			'content-type': 'application/json',
			'x-api-key': apiKey,
			...(init?.headers ?? {}),
		},
		signal: AbortSignal.timeout(30_000),
	})
	return { status: response.status, data: await readJson(response) }
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

function findScheduleId(value: unknown, scheduleName: string): string | null {
	if (isRecord(value)) {
		if (value.name === scheduleName) {
			const found = findString(value, ['scheduleId', 'id'])
			if (found) return found
		}
		for (const child of Object.values(value)) {
			const found = findScheduleId(child, scheduleName)
			if (found) return found
		}
	}
	if (Array.isArray(value)) {
		for (const child of value) {
			const found = findScheduleId(child, scheduleName)
			if (found) return found
		}
	}
	return null
}

function findDeploymentIds(value: unknown, scheduleId: string, result = new Set<string>()): Set<string> {
	if (Array.isArray(value)) {
		for (const child of value) findDeploymentIds(child, scheduleId, result)
	}
	if (isRecord(value)) {
		if (value.scheduleId === scheduleId && typeof value.deploymentId === 'string' && value.deploymentId) {
			result.add(value.deploymentId)
		}
		for (const child of Object.values(value)) findDeploymentIds(child, scheduleId, result)
	}
	return result
}

function findDeploymentIdsInList(value: unknown, result = new Set<string>()): Set<string> {
	if (Array.isArray(value)) {
		for (const child of value) findDeploymentIdsInList(child, result)
	}
	if (isRecord(value)) {
		if (typeof value.deploymentId === 'string' && value.deploymentId) result.add(value.deploymentId)
		for (const child of Object.values(value)) findDeploymentIdsInList(child, result)
	}
	return result
}

function collectDeploymentState(
	value: unknown,
	deploymentIds: Set<string>,
	statuses = new Set<string>(),
): { statuses: Set<string>; logPathPresent: boolean } {
	let logPathPresent = false
	if (Array.isArray(value)) {
		for (const child of value) {
			const nested = collectDeploymentState(child, deploymentIds, statuses)
			logPathPresent ||= nested.logPathPresent
		}
	}
	if (isRecord(value)) {
		if (typeof value.deploymentId === 'string' && deploymentIds.has(value.deploymentId)) {
			if (typeof value.status === 'string') statuses.add(value.status)
			if (typeof value.logPath === 'string' && value.logPath.length > 0) logPathPresent = true
		}
		for (const child of Object.values(value)) {
			const nested = collectDeploymentState(child, deploymentIds, statuses)
			logPathPresent ||= nested.logPathPresent
		}
	}
	return { statuses, logPathPresent }
}

function logText(value: unknown): string {
	const values: string[] = []
	const collect = (child: unknown): void => {
		if (typeof child === 'string') values.push(child)
		else if (Array.isArray(child)) child.forEach(collect)
		else if (isRecord(child)) Object.values(child).forEach(collect)
	}
	collect(value)
	return values.join('\n')
}

function extractMarker(logs: string): { marker: string; result: ProductionRoomsControlResult } | null {
	const markers = [
		'JPV_ROOMS_MIGRATION_PLAN_OK',
		'JPV_ROOMS_MIGRATION_PLAN_BLOCKED',
		'JPV_ROOMS_MIGRATION_APPLIED',
		'JPV_ROOMS_MIGRATION_UNCERTAIN',
		'JPV_ROOMS_MIGRATION_FAILED',
		'JPV_ROOMS_NAV_FINALIZED',
	]
	for (const marker of markers) {
		const index = logs.lastIndexOf(marker)
		if (index < 0) continue
		const json = logs.slice(index + marker.length).trimStart().split('\n', 1)[0]
		try {
			const result = JSON.parse(json) as ProductionRoomsControlResult
			if (isRecord(result) && typeof result.resultCode === 'string' && typeof result.ok === 'boolean') return { marker, result }
		} catch {
			return null
		}
	}
	return null
}

async function assertExpectedProductionRelease(expectedSha: string): Promise<void> {
	const response = await fetch(`${PRODUCTION_ROOMS_TARGET.origin}/api/health/deployment?rooms_migration_probe=${expectedSha.slice(0, 8)}`, {
		cache: 'no-store',
		redirect: 'error',
		signal: AbortSignal.timeout(15_000),
	})
	const body = await readJson(response)
	const imageTag = isRecord(body) && typeof body.imageTag === 'string' ? body.imageTag : ''
	if (!response.ok || imageTag !== expectedSha) throw new Error('production_release_sha_mismatch')
}

async function runProductionSchedule(payload: ProductionRoomsControlPayload): Promise<ProductionRoomsControlResult> {
	const apiKey = required('DOKPLOY_API_KEY')
	const apiBase = (process.env.DOKPLOY_API_BASE_URL?.trim() || 'https://dokploy.prochat.tools/api').replace(/\/$/, '')
	const scheduleName = `jpv-production-rooms-${payload.mode}-${process.env.GITHUB_RUN_ID ?? Date.now()}`
	const command = buildRemoteScheduleCommand(payload, `${payload.mode}-${process.env.GITHUB_RUN_ID ?? 'manual'}`)
	const created = await dokployRequest(apiBase, apiKey, '/schedule.create', {
		method: 'POST',
		body: JSON.stringify({
			name: scheduleName,
			description: `One-off guarded Rooms ${payload.mode} for ${PRODUCTION_ROOMS_TARGET.applicationName}`,
			cronExpression: '0 0 1 1 *',
			command,
			shellType: 'bash',
			scheduleType: 'application',
			applicationId: PRODUCTION_ROOMS_TARGET.applicationId,
			enabled: false,
		}),
	})
	if (created.status < 200 || created.status >= 300) throw new Error('schedule_create_failed')
	let scheduleId = findScheduleId(created.data, scheduleName) ?? findString(created.data, ['scheduleId'])
	try {
		if (!scheduleId) {
			const listed = await dokployRequest(apiBase, apiKey, `/schedule.list?id=${encodeURIComponent(PRODUCTION_ROOMS_TARGET.applicationId)}&scheduleType=application`)
			if (listed.status < 200 || listed.status >= 300) throw new Error('schedule_list_failed')
			scheduleId = findScheduleId(listed.data, scheduleName)
		}
		if (!scheduleId) throw new Error('schedule_id_missing')
		const run = await dokployRequest(apiBase, apiKey, '/schedule.runManually', {
			method: 'POST',
			body: JSON.stringify({ scheduleId }),
		})
		const runDeploymentIds = findDeploymentIdsInList(run.data)
		if (run.status < 200 || run.status >= 300) console.log(`Rooms ${payload.mode} start returned HTTP ${run.status}; polling deployment logs`)
		let lastScheduleListStatus = 0
		let lastDeploymentListStatus = 0
		let lastLogsStatus = 0
		let lastDeploymentCount = runDeploymentIds.size
		let logBytes = 0
		let logHasRemoteStart = false
		let logHasControlMarker = false
		let logHasKnownExecutionError = false
		let logEchoesRemoteCommand = false
		let logHasExecutionBanner = false
		let logHasSuccessBanner = false
		let deploymentStatuses = new Set<string>()
		let logPathPresent = false
		for (let attempt = 1; attempt <= 36; attempt += 1) {
			const deploymentIds = new Set(runDeploymentIds)
			const listed = await dokployRequest(apiBase, apiKey, `/schedule.list?id=${encodeURIComponent(PRODUCTION_ROOMS_TARGET.applicationId)}&scheduleType=application`)
			lastScheduleListStatus = listed.status
			if (listed.status >= 200 && listed.status < 300) {
				for (const deploymentId of findDeploymentIds(listed.data, scheduleId)) deploymentIds.add(deploymentId)
			}
			const deployments = await dokployRequest(
				apiBase,
				apiKey,
				`/deployment.allByType?id=${encodeURIComponent(scheduleId)}&type=schedule`,
			)
			lastDeploymentListStatus = deployments.status
			if (deployments.status >= 200 && deployments.status < 300) {
				for (const deploymentId of findDeploymentIdsInList(deployments.data)) deploymentIds.add(deploymentId)
				const deploymentState = collectDeploymentState(deployments.data, deploymentIds)
				deploymentStatuses = deploymentState.statuses
				logPathPresent ||= deploymentState.logPathPresent
			}
			lastDeploymentCount = deploymentIds.size
			for (const deploymentId of deploymentIds) {
				const logs = await dokployRequest(apiBase, apiKey, `/deployment.readLogs?deploymentId=${encodeURIComponent(deploymentId)}&tail=10000`)
				lastLogsStatus = logs.status
				if (logs.status >= 200 && logs.status < 300) {
					const text = logText(logs.data)
					logBytes = Math.max(logBytes, text.length)
					logHasRemoteStart ||= /(?:^|\r?\n)JPV_ROOMS_REMOTE_START(?:\r?\n|$)/.test(text)
					logEchoesRemoteCommand ||= text.includes(command)
					logHasExecutionBanner ||= /(?:^|\r?\n)Running scheduled command(?:\r?\n|$)/.test(text)
					logHasSuccessBanner ||= /(?:^|\r?\n)✅ Command executed successfully(?:\r?\n|$)/.test(text)
					logHasControlMarker ||= /JPV_ROOMS_(?:MIGRATION|NAV)_/.test(text)
					logHasKnownExecutionError ||= /(?:command not found|cannot find module|no such file|permission denied|exec format error)/i.test(text)
					const marker = extractMarker(text)
					if (marker) return marker.result
				}
			}
			if (attempt < 36) await new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000))
		}
		console.log(`Rooms ${payload.mode} completion marker missing; schedule_list_http=${lastScheduleListStatus} deployment_list_http=${lastDeploymentListStatus} logs_http=${lastLogsStatus} deployment_records=${lastDeploymentCount} log_bytes=${logBytes} remote_started=${logHasRemoteStart} command_echo=${logEchoesRemoteCommand} execution_banner=${logHasExecutionBanner} success_banner=${logHasSuccessBanner} control_marker_seen=${logHasControlMarker} known_execution_error=${logHasKnownExecutionError} deployment_statuses=${[...deploymentStatuses].filter((status) => /^(?:queued|running|done|error|failed|cancelled)$/i.test(status)).join(',') || 'none'} log_path_present=${logPathPresent}`)
		throw new Error('schedule_completion_marker_missing')
	} finally {
		if (scheduleId) {
			const deleted = await dokployRequest(apiBase, apiKey, '/schedule.delete', {
				method: 'POST',
				body: JSON.stringify({ scheduleId }),
			})
			if (deleted.status < 200 || deleted.status >= 300) throw new Error('schedule_cleanup_failed')
		}
	}
}

function currentCommit(): string {
	return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim()
}

function validateWorkflowInputs(mode: ProductionRoomsMigrationMode): { expectedSourceSha: string; expectedProductionSha: string } {
	const expectedSourceSha = assertSha(required('EXPECTED_SOURCE_SHA'), 'expected_source_sha')
	const expectedProductionSha = assertSha(required('EXPECTED_PRODUCTION_SHA'), 'expected_production_sha')
	if (currentCommit() !== expectedSourceSha) throw new Error('source_sha_mismatch')
	const ref = process.env.GITHUB_REF_NAME?.trim()
	if (ref !== 'main') throw new Error('default_branch_control_required')
	if ((mode === 'plan' || mode === 'apply') && required('ROOMS_SOURCE_BRANCH') !== 'feature/member-portal-rooms') throw new Error('feature_source_branch_required')
	if (mode === 'finalize' && ref !== 'main') throw new Error('main_source_ref_required')
	assertSha(required('EXPECTED_MAIN_SHA'), 'expected_main_sha')
	const confirmation = required('CONFIRMATION')
	const expectedConfirmation = mode === 'plan'
		? PRODUCTION_ROOMS_MIGRATION_PLAN_CONFIRMATION
		: mode === 'apply' ? PRODUCTION_ROOMS_MIGRATION_APPLY_CONFIRMATION : PRODUCTION_ROOMS_NAV_FINALIZE_CONFIRMATION
	if (confirmation !== expectedConfirmation) throw new Error('confirmation_invalid')
	if (required('BACKUP_EVIDENCE_ID') !== PRODUCTION_ROOMS_BACKUP_EVIDENCE_ID) throw new Error('backup_evidence_mismatch')
	if (assertSha256(required('BACKUP_SHA256'), 'backup_sha256') !== PRODUCTION_ROOMS_BACKUP_SHA256) throw new Error('backup_checksum_mismatch')
	assertReference(required('REHEARSAL_EVIDENCE_ID'), 'rehearsal_evidence_id')
	assertReference(required('ROLLBACK_OWNER'), 'rollback_owner')
	assertReference(required('MAINTENANCE_WINDOW_ID'), 'maintenance_window_id')
	assertReference(required('OPERATOR_ID'), 'operator_id')
	return { expectedSourceSha, expectedProductionSha }
}

async function runProductionMode(mode: ProductionRoomsMigrationMode): Promise<ProductionRoomsControlResult> {
	const { expectedProductionSha } = validateWorkflowInputs(mode)
	await assertExpectedProductionRelease(expectedProductionSha)
	const payload = buildMigrationPayload(mode, 'production', {
		operatorId: required('OPERATOR_ID'),
		backupEvidenceId: required('BACKUP_EVIDENCE_ID'),
		backupSha256: required('BACKUP_SHA256'),
		rehearsalEvidenceId: required('REHEARSAL_EVIDENCE_ID'),
		rollbackOwner: required('ROLLBACK_OWNER'),
		maintenanceWindowId: required('MAINTENANCE_WINDOW_ID'),
	})
	const result = await runProductionSchedule(payload)
	if (!result.ok) throw new Error(`production_rooms_${result.resultCode}`)
	return result
}

export function runRestoredBackupRehearsal(databaseUrl: string, evidenceId: string): ProductionRoomsControlResult {
	if (!databaseUrl.trim()) throw new Error('rehearsal_database_url_missing')
	if (assertSha256(required('REHEARSAL_DUMP_SHA256'), 'rehearsal_dump_sha256') !== PRODUCTION_ROOMS_BACKUP_SHA256) throw new Error('rehearsal_dump_checksum_mismatch')
	assertReference(evidenceId, 'rehearsal_evidence_id')
	const payload = buildMigrationPayload('apply', 'rehearsal', {
		backupEvidenceId: PRODUCTION_ROOMS_BACKUP_EVIDENCE_ID,
		backupSha256: PRODUCTION_ROOMS_BACKUP_SHA256,
		rehearsalEvidenceId: evidenceId,
	})
	const result = spawnSync(process.execPath, [runnerPath], {
		cwd: repoRoot,
		env: {
			...process.env,
			DATABASE_URL: databaseUrl,
			DEPLOYMENT_ENV: 'rehearsal',
			ROOMS_MIGRATION_TARGET: 'rehearsal',
			ROOMS_REHEARSAL_CONFIRMATION,
			ROOMS_REHEARSAL_EVIDENCE_ID: evidenceId,
			ROOMS_MIGRATION_PAYLOAD_B64: encoded(payload),
		},
		encoding: 'utf8',
		stdio: ['ignore', 'pipe', 'pipe'],
	})
	const output = `${result.stdout ?? ''}`.trim().split('\n').filter(Boolean).at(-1) ?? ''
	try {
		const jsonStart = output.indexOf('{')
		const parsed = JSON.parse(output.slice(jsonStart)) as ProductionRoomsControlResult
		if (parsed.resultCode === 'applied' && parsed.ok === true) return parsed
		throw new Error(`rehearsal_${parsed.resultCode ?? 'failed'}`)
	} catch {
		throw new Error(result.status === 0 ? 'rehearsal_result_invalid' : 'rehearsal_failed')
	}
}

async function main(): Promise<void> {
	try {
		const requestedMode = required('ROOMS_MIGRATION_MODE')
		if (requestedMode === 'rehearsal') {
			const result = runRestoredBackupRehearsal(required('ROOMS_REHEARSAL_DATABASE_URL'), required('REHEARSAL_EVIDENCE_ID'))
			process.stdout.write(`${JSON.stringify(result)}\n`)
			return
		}
		const mode = requestedMode as ProductionRoomsMigrationMode
		if (!['plan', 'apply', 'finalize'].includes(mode)) throw new Error('migration_mode_invalid')
		const result = await runProductionMode(mode)
		process.stdout.write(`${JSON.stringify(result)}\n`)
	} catch (error) {
		const code = error instanceof Error && /^[a-z0-9_:-]+$/.test(error.message) ? error.message : 'production_rooms_control_failed'
		process.stdout.write(`${JSON.stringify({ version: 1, ok: false, resultCode: 'blocked', blockers: [code] })}\n`)
		process.exitCode = 1
	}
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (isEntrypoint) void main()

export {
	PRODUCTION_ROOMS_CRITICAL_TABLES,
	PRODUCTION_ROOMS_TARGET,
}
