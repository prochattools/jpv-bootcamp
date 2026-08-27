const PRODUCTION_ORIGIN = 'https://jpvbootcamp.com'
const PRODUCTION_APPLICATION_ID = 'I_2Vukga3cc3ZhaG-mUzU'
const PRODUCTION_APPLICATION_NAME = 'clients-jpv-bootcamp-app-tp9xrk'
const MAXIMUM_ATTEMPTS = 30
const DELAY_MILLISECONDS = 5_000

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireEnvironment(name: 'DOKPLOY_API_KEY' | 'EXPECTED_DEPLOYMENT_SHA'): string {
	const value = process.env[name]?.trim()
	if (!value) throw new Error(`PRISMA-MIGRATION-DENIED: ${name} is required`)
	return value
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
		for (const key of keys) {
			if (typeof value[key] === 'string' && value[key]) return value[key] as string
		}
		for (const nested of Object.values(value)) {
			const found = findString(nested, keys)
			if (found) return found
		}
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = findString(item, keys)
			if (found) return found
		}
	}
	return null
}

function findScheduleId(value: unknown, scheduleName: string): string | null {
	if (isRecord(value)) {
		if (value.name === scheduleName) {
			const scheduleId = findString(value, ['scheduleId', 'id'])
			if (scheduleId) return scheduleId
		}
		for (const nested of Object.values(value)) {
			const found = findScheduleId(nested, scheduleName)
			if (found) return found
		}
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = findScheduleId(item, scheduleName)
			if (found) return found
		}
	}
	return null
}

function findDeploymentId(value: unknown, scheduleId: string): string | null {
	if (isRecord(value)) {
		if (value.scheduleId === scheduleId && Array.isArray(value.deployments)) {
			for (const deployment of value.deployments) {
				const deploymentId = findString(deployment, ['deploymentId'])
				if (deploymentId) return deploymentId
			}
		}
		for (const nested of Object.values(value)) {
			const found = findDeploymentId(nested, scheduleId)
			if (found) return found
		}
	}
	if (Array.isArray(value)) {
		for (const item of value) {
			const found = findDeploymentId(item, scheduleId)
			if (found) return found
		}
	}
	return null
}

function logText(value: unknown): string {
	if (typeof value === 'string') return value
	if (isRecord(value) || Array.isArray(value)) {
		const strings: string[] = []
		const collect = (nested: unknown): void => {
			if (typeof nested === 'string') strings.push(nested)
			else if (Array.isArray(nested)) nested.forEach(collect)
			else if (isRecord(nested)) Object.values(nested).forEach(collect)
		}
		collect(value)
		return strings.join('\n')
	}
	return ''
}

async function assertExpectedProductionRelease(expectedSha: string): Promise<void> {
	const response = await fetch(
		`${PRODUCTION_ORIGIN}/api/health/deployment?migration_probe=${expectedSha.slice(0, 8)}`,
		{ cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000) },
	)
	const body = await readJson(response)
	const imageTag = isRecord(body) && typeof body.imageTag === 'string' ? body.imageTag : ''
	if (!response.ok || imageTag !== expectedSha) {
		throw new Error(`PRISMA-MIGRATION-DENIED: ${PRODUCTION_APPLICATION_NAME} is not serving the expected release`)
	}
}

async function runMigration(): Promise<void> {
	const expectedSha = requireEnvironment('EXPECTED_DEPLOYMENT_SHA')
	if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
		throw new Error('PRISMA-MIGRATION-DENIED: EXPECTED_DEPLOYMENT_SHA must be a full lowercase 40-character SHA')
	}
	const apiKey = requireEnvironment('DOKPLOY_API_KEY')
	const apiBase = (process.env.DOKPLOY_API_BASE_URL?.trim() || 'https://dokploy.prochat.tools/api').replace(/\/$/, '')

	await assertExpectedProductionRelease(expectedSha)

	const scheduleName = `jpv-production-prisma-migration-${process.env.GITHUB_RUN_ID ?? expectedSha.slice(0, 8)}`
	const command = 'bash /app/scripts/release/run-production-prisma-migrations.sh'
	const create = await dokployRequest(apiBase, apiKey, '/schedule.create', {
		method: 'POST',
		body: JSON.stringify({
			name: scheduleName,
			description: `One-off production Prisma migration for ${PRODUCTION_APPLICATION_NAME}; release ${expectedSha}`,
			cronExpression: '0 0 1 1 *',
			command,
			shellType: 'bash',
			scheduleType: 'application',
			applicationId: PRODUCTION_APPLICATION_ID,
			enabled: false,
		}),
	})
	if (create.status < 200 || create.status >= 300) {
		throw new Error(`PRISMA-MIGRATION-FAILED: schedule.create returned HTTP ${create.status}`)
	}

	let scheduleId = findScheduleId(create.data, scheduleName) ?? findString(create.data, ['scheduleId'])
	try {
		if (!scheduleId) {
			const listed = await dokployRequest(
				apiBase,
				apiKey,
				`/schedule.list?id=${encodeURIComponent(PRODUCTION_APPLICATION_ID)}&scheduleType=application`,
			)
			if (listed.status < 200 || listed.status >= 300) {
				throw new Error(`PRISMA-MIGRATION-FAILED: schedule.list returned HTTP ${listed.status}`)
			}
			scheduleId = findScheduleId(listed.data, scheduleName)
		}
		if (!scheduleId) throw new Error('PRISMA-MIGRATION-FAILED: temporary schedule id was not returned')
		console.log(`Temporary production migration job created for ${PRODUCTION_APPLICATION_NAME}`)

		const run = await dokployRequest(apiBase, apiKey, '/schedule.runManually', {
			method: 'POST',
			body: JSON.stringify({ scheduleId }),
		})
		if (run.status < 200 || run.status >= 300) {
			console.log(`Migration job start returned HTTP ${run.status}; polling its deployment log`)
		}

		for (let attempt = 1; attempt <= MAXIMUM_ATTEMPTS; attempt += 1) {
			const listed = await dokployRequest(
				apiBase,
				apiKey,
				`/schedule.list?id=${encodeURIComponent(PRODUCTION_APPLICATION_ID)}&scheduleType=application`,
			)
			if (listed.status >= 200 && listed.status < 300) {
				const deploymentId = findDeploymentId(listed.data, scheduleId)
				if (deploymentId) {
					const logs = await dokployRequest(
						apiBase,
						apiKey,
						`/deployment.readLogs?deploymentId=${encodeURIComponent(deploymentId)}&tail=10000`,
					)
					if (logs.status >= 200 && logs.status < 300) {
						const text = logText(logs.data)
						if (text.includes('JPV_PRISMA_MIGRATION_APPLIED')) {
							console.log('JPV_PRISMA_MIGRATION_APPLIED production schema migration completed')
							return
						}
						if (text.includes('JPV_PRISMA_MIGRATION_FAILED')) {
							throw new Error('PRISMA-MIGRATION-FAILED: migration job reported failure')
						}
					}
				}
			}
			console.log(`Waiting for the production migration job (attempt ${attempt}/${MAXIMUM_ATTEMPTS})`)
			if (attempt < MAXIMUM_ATTEMPTS) {
				await new Promise((resolve) => setTimeout(resolve, DELAY_MILLISECONDS))
			}
		}
		throw new Error('PRISMA-MIGRATION-FAILED: no successful completion marker was found')
	} finally {
		if (scheduleId) {
			const deleted = await dokployRequest(apiBase, apiKey, '/schedule.delete', {
				method: 'POST',
				body: JSON.stringify({ scheduleId }),
			})
			if (deleted.status < 200 || deleted.status >= 300) {
				throw new Error(`PRISMA-MIGRATION-FAILED: temporary job cleanup returned HTTP ${deleted.status}`)
			}
			console.log('Temporary production migration job deleted')
		}
	}
}

try {
	await runMigration()
} catch (error) {
	console.error(error instanceof Error ? error.message : 'PRISMA-MIGRATION-FAILED: unknown error')
	process.exitCode = 1
}
