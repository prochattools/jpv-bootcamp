import { pathToFileURL } from 'node:url'

import { isMightyApiBaseUrl, isMightyStudentLoginUrl, JPV_MIGHTY_ACCESS_PLAN_ID } from '../../src/lib/mighty/config'

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

function positiveInteger(value: string): boolean {
	const parsed = Number(value)
	return Number.isInteger(parsed) && parsed > 0
}

function providerEnvironment(value: string): boolean {
	return value === 'production' || value === 'staging'
}

export function checkConfiguration(env: Record<string, string | undefined> = process.env) {
	const provider: Record<string, Presence> = {
		MIGHTY_API_BASE_URL: presence(env.MIGHTY_API_BASE_URL, isMightyApiBaseUrl),
		MIGHTY_NETWORK_ID: presence(env.MIGHTY_NETWORK_ID),
		MIGHTY_ACCESS_PLAN_ID: presence(env.MIGHTY_ACCESS_PLAN_ID, (value) => positiveInteger(value) && (env.MIGHTY_PROVIDER_ENV?.trim().toLowerCase() !== 'production' || value === String(JPV_MIGHTY_ACCESS_PLAN_ID))),
		MIGHTY_ADMIN_API_TOKEN: presence(env.MIGHTY_ADMIN_API_TOKEN),
		MIGHTY_STUDENT_LOGIN_URL: presence(env.MIGHTY_STUDENT_LOGIN_URL, isMightyStudentLoginUrl),
		MIGHTY_ACCESS_SYNC_WORKER_SECRET: presence(env.MIGHTY_ACCESS_SYNC_WORKER_SECRET),
	}
	const controls: Record<string, Presence> = {
		MIGHTY_PROVIDER_ENV: presence(env.MIGHTY_PROVIDER_ENV, providerEnvironment),
		MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS: presence(env.MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS, (value) => value === 'true'),
		MIGHTY_PRODUCTION_TEST_EMAIL: presence(env.MIGHTY_PRODUCTION_TEST_EMAIL),
	}
	const missingOrInvalid = [...Object.entries(provider), ...Object.entries(controls)]
		.filter(([, state]) => state !== 'PRESENT')
		.map(([key, state]) => `${key}_${state}`)
	const planIdVerification = provider.MIGHTY_ACCESS_PLAN_ID === 'PRESENT'
		? 'provider_lookup_required'
		: 'not_configured'
	const configurationShapeReady = missingOrInvalid.length === 0
	const blockingReasons = [
		...missingOrInvalid,
		...(planIdVerification === 'provider_lookup_required'
			? ['MIGHTY_ACCESS_PLAN_ID_PROVIDER_VERIFICATION_REQUIRED']
			: []),
	]

	return {
		readOnly: true,
		provider,
		controls,
		planIdVerification,
		configurationShapeReady,
		readyForAcceptance: configurationShapeReady && planIdVerification === 'verified',
		blockingReasons,
	}
}

const invokedPath = process.argv[1]
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
	console.log(JSON.stringify(checkConfiguration(), null, 2))
}
