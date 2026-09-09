export type MightyConfig = {
	apiBaseUrl: string
	networkId: string
	accessPlanId: number
	adminApiToken: string
	studentLoginUrl: string
}

type Env = Record<string, string | undefined>

function required(env: Env, key: string): string {
	const value = env[key]?.trim()
	if (!value) throw new Error(`Missing required env var: ${key}`)
	return value
}

function requiredUrl(env: Env, key: string): string {
	const value = required(env, key)
	let parsed: URL
	try {
		parsed = new URL(value)
	} catch {
		throw new Error(`Invalid URL for env var: ${key}`)
	}
	if (parsed.protocol !== 'https:') {
		throw new Error(`Mighty URL must use https: (${key})`)
	}
	return value.replace(/\/$/, '')
}

function requiredPositiveInteger(env: Env, key: string): number {
	const value = required(env, key)
	const parsed = Number(value)
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new Error(`Invalid positive integer for env var: ${key}`)
	}
	return parsed
}

export function parseMightyConfig(env: Env = process.env): MightyConfig {
	return {
		apiBaseUrl: requiredUrl(env, 'MIGHTY_API_BASE_URL'),
		networkId: required(env, 'MIGHTY_NETWORK_ID'),
		accessPlanId: requiredPositiveInteger(env, 'MIGHTY_ACCESS_PLAN_ID'),
		adminApiToken: required(env, 'MIGHTY_ADMIN_API_TOKEN'),
		studentLoginUrl: requiredUrl(env, 'MIGHTY_STUDENT_LOGIN_URL'),
	}
}

export function getMightyConfig(): MightyConfig {
	return parseMightyConfig()
}
