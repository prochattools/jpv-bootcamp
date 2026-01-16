import 'server-only'
import { getServerConfig } from '@/lib/config'

type ProvisionPayload = {
	email: string
	plan: string
	name?: string | null
	stripeCustomerId?: string | null
}

type ProvisionResponse = {
	ok?: boolean
	wp_user_id?: number
	wpUserId?: number
	reset_link?: string
	resetLink?: string
	error?: string
}

export type ProvisionResult = {
	wpUserId: number
	resetLink: string
}

let hasLoggedProvisioningDisabled = false

function normalizePlan(value: string): string {
	return value.trim().toLowerCase()
}

function normalizeEmail(email: string): string {
	return email.trim().toLowerCase()
}

function getProvisionUrl(): string {
	const { wp } = getServerConfig()
	if (!wp.baseUrl || !wp.provisionEndpoint) {
		throw new Error('WP provisioning is enabled but config is incomplete.')
	}
	return new URL(wp.provisionEndpoint, wp.baseUrl).toString()
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
	if (!wp.provisionToken) {
		throw new Error('WP provisioning is enabled but token is missing.')
	}
	const body = {
		email,
		plan,
		name: payload.name ?? null,
		stripe_customer_id: payload.stripeCustomerId ?? undefined,
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

	const text = await response.text()
	let data: ProvisionResponse | null = null
	try {
		data = text ? (JSON.parse(text) as ProvisionResponse) : null
	} catch {
		data = null
	}

	if (!response.ok) {
		const message =
			typeof data?.error === 'string'
				? data.error
				: `WP provisioning failed with status ${response.status}`
		throw new Error(message)
	}

	const wpUserId = data?.wp_user_id ?? data?.wpUserId
	const resetLink = data?.reset_link ?? data?.resetLink

	if (!wpUserId || !resetLink) {
		throw new Error('WP provisioning response missing required fields.')
	}

	return {
		wpUserId,
		resetLink,
	}
}
