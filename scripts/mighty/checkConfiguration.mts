import { pathToFileURL } from 'node:url'

type Presence = 'PRESENT' | 'MISSING' | 'INVALID'

const PROVIDER_KEYS = [
	'MIGHTY_API_BASE_URL',
	'MIGHTY_NETWORK_ID',
	'MIGHTY_ACCESS_PLAN_ID',
	'MIGHTY_ADMIN_API_TOKEN',
	'MIGHTY_STUDENT_LOGIN_URL',
	'MIGHTY_ACCESS_SYNC_WORKER_SECRET',
] as const

const CONTROL_KEYS = [
	'MIGHTY_PROVIDER_ENV',
	'MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS',
	'MIGHTY_PRODUCTION_TEST_EMAIL',
] as const

function presence(value: string | undefined, validator?: (value: string) => boolean): Presence {
	const normalized = value?.trim()
	if (!normalized) return 'MISSING'
	return validator && !validator(normalized) ? 'INVALID' : 'PRESENT'
}

function httpsUrl(value: string): boolean {
	try {
		return new URL(value).protocol === 'https:'
	} catch {
		return false
	}
}

function positiveInteger(value: string): boolean {
	const parsed = Number(value)
	return Number.isInteger(parsed) && parsed > 0
}

export function checkConfiguration(env: Record<string, string | undefined> = process.env) {
	const provider: Record<string, Presence> = {
		MIGHTY_API_BASE_URL: presence(env.MIGHTY_API_BASE_URL, httpsUrl),
		MIGHTY_NETWORK_ID: presence(env.MIGHTY_NETWORK_ID),
		MIGHTY_ACCESS_PLAN_ID: presence(env.MIGHTY_ACCESS_PLAN_ID, positiveInteger),
		MIGHTY_ADMIN_API_TOKEN: presence(env.MIGHTY_ADMIN_API_TOKEN),
		MIGHTY_STUDENT_LOGIN_URL: presence(env.MIGHTY_STUDENT_LOGIN_URL, httpsUrl),
		MIGHTY_ACCESS_SYNC_WORKER_SECRET: presence(env.MIGHTY_ACCESS_SYNC_WORKER_SECRET),
	}
	const controls: Record<string, Presence> = {
		MIGHTY_PROVIDER_ENV: presence(env.MIGHTY_PROVIDER_ENV),
		MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS: presence(env.MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS, (value) => value === 'true'),
		MIGHTY_PRODUCTION_TEST_EMAIL: presence(env.MIGHTY_PRODUCTION_TEST_EMAIL),
	}
	const missingOrInvalid = [...Object.entries(provider), ...Object.entries(controls)]
		.filter(([, state]) => state !== 'PRESENT')
		.map(([key, state]) => `${key}_${state}`)

	return {
		readOnly: true,
		provider,
		controls,
		planIdVerification: provider.MIGHTY_ACCESS_PLAN_ID === 'PRESENT' ? 'provider_lookup_required' : 'not_configured',
		readyForAcceptance: missingOrInvalid.length === 0,
		blockingReasons: missingOrInvalid,
	}
}

const invokedPath = process.argv[1]
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
	console.log(JSON.stringify(checkConfiguration(), null, 2))
}
