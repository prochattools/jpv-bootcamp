export type MightyConfig = {
	apiBaseUrl: string
	networkId: string
	accessPlanId: number
	adminApiToken: string
	studentLoginUrl: string
}

export const JPV_MIGHTY_ACCESS_PLAN_ID = 2000039

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

export function isMightyApiBaseUrl(value: string): boolean {
	try {
		const parsed = new URL(value)
		return (
			parsed.protocol === 'https:' &&
			parsed.hostname === 'api.mn.co' &&
			parsed.pathname.replace(/\/+$/, '') === '/admin/v1' &&
			!parsed.search &&
			!parsed.hash
		)
	} catch {
		return false
	}
}

export function isMightyStudentLoginUrl(value: string): boolean {
	try {
		const parsed = new URL(value)
		return parsed.protocol === 'https:' && parsed.hostname === 'jpv-community.mn.co' && parsed.pathname === '/sign_in'
	} catch {
		return false
	}
}

function requiredPositiveInteger(env: Env, key: string): number {
	const value = required(env, key)
	const parsed = Number(value)
	if (!Number.isInteger(parsed) || parsed <= 0) {
		throw new Error(`Invalid positive integer for env var: ${key}`)
	}
	return parsed
}

function requiredAccessPlanId(env: Env): number {
	const planId = requiredPositiveInteger(env, 'MIGHTY_ACCESS_PLAN_ID')
	if (env.MIGHTY_PROVIDER_ENV?.trim().toLowerCase() === 'production' && planId !== JPV_MIGHTY_ACCESS_PLAN_ID) {
		throw new Error(`MIGHTY_ACCESS_PLAN_ID must be ${JPV_MIGHTY_ACCESS_PLAN_ID} in production`)
	}
	return planId
}

export function parseMightyConfig(env: Env = process.env): MightyConfig {
	const apiBaseUrl = requiredUrl(env, 'MIGHTY_API_BASE_URL')
	if (!isMightyApiBaseUrl(apiBaseUrl)) throw new Error('MIGHTY_API_BASE_URL must be https://api.mn.co/admin/v1')
	const studentLoginUrl = requiredUrl(env, 'MIGHTY_STUDENT_LOGIN_URL')
	if (!isMightyStudentLoginUrl(studentLoginUrl)) throw new Error('MIGHTY_STUDENT_LOGIN_URL must target the JPV /sign_in URL')

	return {
		apiBaseUrl,
		networkId: required(env, 'MIGHTY_NETWORK_ID'),
		accessPlanId: requiredAccessPlanId(env),
		adminApiToken: required(env, 'MIGHTY_ADMIN_API_TOKEN'),
		studentLoginUrl,
	}
}

export function getMightyConfig(): MightyConfig {
	return parseMightyConfig()
}
