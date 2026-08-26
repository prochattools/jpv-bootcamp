const PRODUCTION_ORIGIN = 'https://jpvbootcamp.com'
const PRODUCTION_APPLICATION_ID = 'I_2Vukga3cc3ZhaG-mUzU'
const PRODUCTION_APPLICATION_NAME = 'clients-jpv-bootcamp-app-tp9xrk'
const MAXIMUM_ATTEMPTS = 40
const DELAY_MILLISECONDS = 15_000
const RETRIGGER_AFTER_ATTEMPT = 10

type UnknownRecord = Record<string, unknown>

function requireEnvironment(name: 'DOKPLOY_API_KEY' | 'EXPECTED_DEPLOYMENT_SHA'): string {
	const value = process.env[name]?.trim()
	if (!value) throw new Error(`ROOT-DEPLOYMENT-DENIED: ${name} is required`)
	return value
}

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asSafeString(value: unknown): string | null {
	return typeof value === 'string' && value.length <= 300 ? value : null
}

function extractImageTag(value: unknown): string {
	return isRecord(value) && typeof value.imageTag === 'string' ? value.imageTag : ''
}

async function readJson(response: Response): Promise<unknown> {
	const text = await response.text()
	if (!text.trim()) return {}
	try {
		return JSON.parse(text) as unknown
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

async function retriggerDeployment(apiBase: string, apiKey: string, expectedSha: string): Promise<void> {
	const image = `ghcr.io/prochattools/jpv-bootcamp:${expectedSha}`
	const update = await dokployRequest(apiBase, apiKey, '/application.update', {
		method: 'POST',
		body: JSON.stringify({ applicationId: PRODUCTION_APPLICATION_ID, dockerImage: image }),
	})
	console.log(JSON.stringify({ action: 'update_production_image', status: update.status, image }))
	if (update.status < 200 || update.status >= 300) {
		throw new Error(`ROOT-DEPLOYMENT-FAILED: application.update returned HTTP ${update.status}`)
	}

	const deploy = await dokployRequest(apiBase, apiKey, '/application.deploy', {
		method: 'POST',
		body: JSON.stringify({
			applicationId: PRODUCTION_APPLICATION_ID,
			title: `production-convergence-retry-${expectedSha.slice(0, 8)}`,
			description: `Convergence retry for ${PRODUCTION_APPLICATION_NAME}; source SHA ${expectedSha}`,
		}),
	})
	console.log(JSON.stringify({ action: 'retrigger_production_deployment', status: deploy.status }))
	if (deploy.status < 200 || deploy.status >= 300) {
		throw new Error(`ROOT-DEPLOYMENT-FAILED: application.deploy returned HTTP ${deploy.status}`)
	}
}

async function reportDokployState(apiBase: string, apiKey: string): Promise<void> {
	const applicationQuery = new URLSearchParams({ applicationId: PRODUCTION_APPLICATION_ID })
	const application = await dokployRequest(apiBase, apiKey, `/application.one?${applicationQuery.toString()}`)
	const deployment = await dokployRequest(apiBase, apiKey, `/deployment.all?${applicationQuery.toString()}`)

	const applicationData = isRecord(application.data) ? application.data : {}
	const deploymentItems = Array.isArray(deployment.data)
		? deployment.data
		: isRecord(deployment.data) && Array.isArray(deployment.data.items)
			? deployment.data.items
			: []

	console.log(JSON.stringify({
		action: 'production_runtime_diagnostic',
		applicationId: PRODUCTION_APPLICATION_ID,
		applicationStatus: asSafeString(applicationData.applicationStatus),
		sourceType: asSafeString(applicationData.sourceType),
		dockerImage: asSafeString(applicationData.dockerImage),
		registryId: asSafeString(applicationData.registryId),
		buildType: asSafeString(applicationData.buildType),
		applicationHttpStatus: application.status,
		deploymentsHttpStatus: deployment.status,
		recentDeployments: deploymentItems.slice(0, 5).map((item) => {
			const record = isRecord(item) ? item : {}
			return {
				deploymentId: asSafeString(record.deploymentId),
				status: asSafeString(record.status),
				title: asSafeString(record.title),
				createdAt: asSafeString(record.createdAt),
				errorMessage: asSafeString(record.errorMessage),
			}
		}),
	}))
}

async function waitForConvergence(): Promise<void> {
	const expectedSha = requireEnvironment('EXPECTED_DEPLOYMENT_SHA')
	if (!/^[0-9a-f]{40}$/.test(expectedSha)) {
		throw new Error('ROOT-DEPLOYMENT-DENIED: EXPECTED_DEPLOYMENT_SHA must be a full lowercase 40-character SHA')
	}

	const apiKey = requireEnvironment('DOKPLOY_API_KEY')
	const apiBase = (process.env.DOKPLOY_API_BASE_URL?.trim() || 'https://dokploy.prochat.tools/api').replace(/\/$/, '')
	const expectedImage = `ghcr.io/prochattools/jpv-bootcamp:${expectedSha}`
	let retriggered = false

	for (let attempt = 1; attempt <= MAXIMUM_ATTEMPTS; attempt += 1) {
		try {
			const response = await fetch(`${PRODUCTION_ORIGIN}/api/health/deployment?release_probe=${expectedSha.slice(0, 8)}_${attempt}`, {
				cache: 'no-store',
				redirect: 'error',
				signal: AbortSignal.timeout(15_000),
			})
			const body = await readJson(response)
			const imageTag = extractImageTag(body)
			if (response.ok && imageTag === expectedSha) {
				console.log(JSON.stringify({ ok: true, attempt, imageTag, expectedImage, retriggered }))
				return
			}
			console.log(JSON.stringify({ ok: false, attempt, httpStatus: response.status, imageTag, expectedSha }))
		} catch (error) {
			console.log(JSON.stringify({
				ok: false,
				attempt,
				error: error instanceof Error ? error.name : 'UnknownError',
			}))
		}

		if (attempt === RETRIGGER_AFTER_ATTEMPT && !retriggered) {
			retriggered = true
			await retriggerDeployment(apiBase, apiKey, expectedSha)
		}

		if (attempt < MAXIMUM_ATTEMPTS) {
			await new Promise((resolve) => setTimeout(resolve, DELAY_MILLISECONDS))
		}
	}

	await reportDokployState(apiBase, apiKey)
	throw new Error(`ROOT-DEPLOYMENT-FAILED: production did not serve ${expectedSha} within 10 minutes`)
}

try {
	await waitForConvergence()
} catch (error) {
	console.error(error instanceof Error ? error.message : 'ROOT-DEPLOYMENT-FAILED: unknown error')
	process.exitCode = 1
}
