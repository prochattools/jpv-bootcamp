import 'server-only'
import { getServerConfig } from '@/lib/config'
import { normalizePlan, type Plan } from '@/lib/plans'

type ProvisionPayload = {
	email: string
	plan: Plan
	name?: string | null
	firstName?: string | null
	lastName?: string | null
	fullName?: string | null
	stripeCustomerId?: string | null
	stripeSubscriptionId?: string | null
}

type ProvisionResponse = {
	ok?: boolean
	wp_user_id?: number
	wpUserId?: number
	reset_link?: string
	resetLink?: string
	created?: boolean
	error?: string
}

type UserExistsResponse = {
	ok?: boolean
	exists?: boolean
	wp_user_id?: number
	wpUserId?: number
	email?: string
	error?: string
}

export type ProvisionResult = {
	wpUserId: number
	resetLink: string
	created: boolean
}

export type WpUserExistsResult = {
	exists: boolean
	wpUserId?: number | null
	email?: string | null
}

export type MembershipPlan = 'pro' | 'vip' | 'free'

let hasLoggedProvisioningDisabled = false
let hasLoggedUserExistsDisabled = false
let hasLoggedProvisioningEndpoint = false

const USER_EXISTS_ENDPOINT = '/wp-json/jpv/v1/user-exists'
const PROVISION_TIMEOUT_MS = 10000
const MAX_BODY_LOG_CHARS = 500

function getRedactedEndpoint(url: string): { endpoint: string; path: string } {
	try {
		const parsed = new URL(url)
		return {
			endpoint: `${parsed.protocol}//<redacted>${parsed.pathname}`,
			path: parsed.pathname,
		}
	} catch {
		return { endpoint: url, path: url }
	}
}

function logProvisioningEndpointOnce(url: string): void {
	if (hasLoggedProvisioningEndpoint) return
	const redacted = getRedactedEndpoint(url)
	console.info('WP provisioning endpoint configured', {
		endpoint: redacted.endpoint,
		path: redacted.path,
	})
	hasLoggedProvisioningEndpoint = true
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase()
}

function getProvisionUrl(): string {
	const { wp } = getServerConfig()
	if (!wp.baseUrl || !wp.provisionEndpoint) {
		throw new Error('WP provisioning is enabled but config is incomplete.')
	}
	const url = new URL(wp.provisionEndpoint, wp.baseUrl).toString()
	logProvisioningEndpointOnce(url)
	return url
}

function getUserExistsUrl(): string {
	const { wp } = getServerConfig()
	if (!wp.baseUrl) {
		throw new Error('WP provisioning is enabled but config is incomplete.')
	}
	return new URL(USER_EXISTS_ENDPOINT, wp.baseUrl).toString()
}

export async function provisionWpUser(
	payload: ProvisionPayload
): Promise<ProvisionResult | null> {
	const { wp } = getServerConfig()
	if (!wp.enabled) {
		if (!hasLoggedProvisioningDisabled) {
			console.warn('WP provisioning disabled; skipping WP user provisioning.')
			hasLoggedProvisioningDisabled = true
		}
		return null
	}

	const email = normalizeEmail(payload.email)
	const plan = normalizePlan(payload.plan)

	if (!email) {
		throw new Error('WP provisioning requires a valid email.')
	}

	if (!plan) {
		throw new Error('WP provisioning requires a membership plan.')
	}

	const url = getProvisionUrl()
	const endpointLog = getRedactedEndpoint(url)
	if (!wp.provisionToken) {
		throw new Error('WP provisioning is enabled but token is missing.')
	}
	const firstName = payload.firstName ?? ''
	const lastName = payload.lastName ?? ''
	const fullName = payload.fullName ?? ''
	const fallbackName = [firstName, lastName].filter(Boolean).join(' ').trim()
	const resolvedName = payload.name ?? (fullName || fallbackName || null)
	const body = {
		email,
		plan,
		jpv_membership_level: plan,
		name: resolvedName,
		firstName,
		lastName,
		fullName,
		stripe_customer_id: payload.stripeCustomerId ?? undefined,
		stripe_subscription_id: payload.stripeSubscriptionId ?? undefined,
	}

	console.info('WP provisioning request', {
		email,
		plan,
		endpointPath: endpointLog.path,
		timeoutMs: PROVISION_TIMEOUT_MS,
	})

	const controller = new AbortController()
	const timeout = setTimeout(() => controller.abort(), PROVISION_TIMEOUT_MS)
	let response: Response
	try {
		response = await fetch(url, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${wp.provisionToken}`,
				Accept: 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
			cache: 'no-store',
			signal: controller.signal,
		})
	} catch (error) {
		const err = error as Error
		const isTimeout = err?.name === 'AbortError'
		console.error('WP provisioning request failed', {
			email,
			plan,
			endpointPath: endpointLog.path,
			errorType: isTimeout ? 'timeout' : 'network_error',
			message: err?.message ?? 'Unknown error',
		})
		throw error
	} finally {
		clearTimeout(timeout)
	}

	const text = await response.text()
	let data: ProvisionResponse | null = null
	let parseError: string | null = null
	try {
		data = text ? (JSON.parse(text) as ProvisionResponse) : null
	} catch {
		parseError = 'Invalid JSON'
		data = null
	}

	const bodySnippet =
		text.length > MAX_BODY_LOG_CHARS ? `${text.slice(0, MAX_BODY_LOG_CHARS)}...` : text

	if (parseError) {
		console.error('WP provisioning response parse error', {
			endpointPath: endpointLog.path,
			status: response.status,
			errorType: 'parse_error',
			bodySnippet,
		})
	}

	if (!response.ok) {
		console.error('WP provisioning response error', {
			endpointPath: endpointLog.path,
			status: response.status,
			errorType: 'non_2xx',
			bodySnippet,
		})
		const message =
			typeof data?.error === 'string'
				? data.error
				: `WP provisioning failed with status ${response.status}`
		throw new Error(message)
	}

	console.info('WP provisioning response', {
		endpointPath: endpointLog.path,
		status: response.status,
		bodySnippet,
	})

	const wpUserId = data?.wp_user_id ?? data?.wpUserId
	const resetLink = data?.reset_link ?? data?.resetLink
	const created = Boolean(data?.created)

	if (!wpUserId || !resetLink) {
		throw new Error('WP provisioning response missing required fields.')
	}

	return {
		wpUserId,
		resetLink,
		created,
	}
}

export async function getWpUserExists(params: {
	wpUserId?: number | null
	email?: string | null
}): Promise<WpUserExistsResult | null> {
	const { wp } = getServerConfig()
	if (!wp.enabled) {
		if (!hasLoggedUserExistsDisabled) {
			console.warn('WP provisioning disabled; skipping WP user existence check.')
			hasLoggedUserExistsDisabled = true
		}
		return null
	}

	const wpUserId =
		typeof params.wpUserId === 'number' ? params.wpUserId : null
	const email = params.email ? normalizeEmail(params.email) : null

	if (!wpUserId && !email) {
		throw new Error('WP user existence check requires wpUserId or email.')
	}

	const url = new URL(getUserExistsUrl())
	if (wpUserId) {
		url.searchParams.set('wp_user_id', String(wpUserId))
	} else if (email) {
		url.searchParams.set('email', email)
	}

	if (!wp.provisionToken) {
		throw new Error('WP provisioning is enabled but token is missing.')
	}

	const response = await fetch(url.toString(), {
		method: 'GET',
		headers: {
			Authorization: `Bearer ${wp.provisionToken}`,
			Accept: 'application/json',
		},
		cache: 'no-store',
	})

	const text = await response.text()
	let data: UserExistsResponse | null = null
	try {
		data = text ? (JSON.parse(text) as UserExistsResponse) : null
	} catch {
		data = null
	}

	if (!response.ok) {
		const message =
			typeof data?.error === 'string'
				? data.error
				: `WP user existence check failed with status ${response.status}`
		throw new Error(message)
	}

	const exists = Boolean(data?.exists)
	const resolvedUserId = data?.wp_user_id ?? data?.wpUserId ?? null
	const resolvedEmail = typeof data?.email === 'string' ? data.email : null

	return {
		exists,
		wpUserId: resolvedUserId,
		email: resolvedEmail,
	}
}

export async function updateWpMembershipLevel(params: {
	email: string
	plan: MembershipPlan
	name?: string | null
	firstName?: string | null
	lastName?: string | null
	fullName?: string | null
	stripeCustomerId?: string | null
	stripeSubscriptionId?: string | null
}): Promise<boolean> {
	const { wp } = getServerConfig()
	if (!wp.enabled) {
		if (!hasLoggedProvisioningDisabled) {
			console.warn('WP provisioning disabled; skipping membership update.')
			hasLoggedProvisioningDisabled = true
		}
		return false
	}

	const email = normalizeEmail(params.email)
	const plan = params.plan.trim().toLowerCase() as MembershipPlan
	if (!email) {
		throw new Error('WP membership update requires a valid email.')
	}
	if (!['pro', 'vip', 'free'].includes(plan)) {
		throw new Error('WP membership update requires a valid plan.')
	}

	const url = getProvisionUrl()
	const endpointLog = getRedactedEndpoint(url)
	if (!wp.provisionToken) {
		throw new Error('WP provisioning is enabled but token is missing.')
	}

	const firstName = params.firstName ?? ''
	const lastName = params.lastName ?? ''
	const fullName = params.fullName ?? ''
	const fallbackName = [firstName, lastName].filter(Boolean).join(' ').trim()
	const resolvedName = params.name ?? (fullName || fallbackName || null)

	const body = {
		email,
		plan,
		jpv_membership_level: plan,
		name: resolvedName,
		firstName,
		lastName,
		fullName,
		stripe_customer_id: params.stripeCustomerId ?? undefined,
		stripe_subscription_id: params.stripeSubscriptionId ?? undefined,
	}

	const response = await fetch(url, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${wp.provisionToken}`,
			Accept: 'application/json',
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
		cache: 'no-store',
	})

	if (!response.ok) {
		const bodyText = await response.text()
		console.error('WP membership update failed', {
			endpointPath: endpointLog.path,
			status: response.status,
			bodySnippet: bodyText.slice(0, MAX_BODY_LOG_CHARS),
		})
		throw new Error(`WP membership update failed with status ${response.status}`)
	}

	return true
}
