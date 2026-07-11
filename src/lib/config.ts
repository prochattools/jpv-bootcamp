import 'server-only'

import { getStripeConfig as getStripeModeConfig } from '@/lib/stripe-config'
import {
	buildSameOriginReturnUrl,
	DEFAULT_STRIPE_SUCCESS_PATH,
} from '@/lib/stripe-checkout-config'

type EnvKey = keyof NodeJS.ProcessEnv

function getEnv(key: EnvKey): string | undefined {
	return process.env[key]
}

function getEnvAny(keys: EnvKey[]): string | undefined {
	for (const key of keys) {
		const value = getEnv(key)
		if (value) return value
	}
	return undefined
}

function getEnvOrDefault(key: EnvKey, fallback: string): string {
	const value = getEnv(key)
	return value && value.trim().length > 0 ? value : fallback
}

function requireEnv(key: EnvKey): string {
	const value = getEnv(key)
	if (!value) {
		throw new Error(`Missing required env var: ${key}`)
	}
	return value
}

function requireEnvAny(keys: EnvKey[], label: string): string {
	const value = getEnvAny(keys)
	if (!value) {
		throw new Error(`Missing required env var: ${label} (${keys.join(' or ')})`)
	}
	return value
}

function requireNumberEnv(key: EnvKey): number {
	const raw = requireEnv(key)
	const value = Number(raw)
	if (!Number.isFinite(value)) {
		throw new Error(`Invalid number for env var: ${key}`)
	}
	return value
}

function requireUrlEnvAny(keys: EnvKey[], label: string): string {
	const value = requireEnvAny(keys, label)
	try {
		new URL(value)
	} catch {
		throw new Error(`Invalid URL for env var: ${label} (${keys.join(' or ')})`)
	}
	return value.replace(/\/$/, '')
}

function normalizeStripeSuccessUrl(raw: string, appUrl: string): string {
	const trimmed = raw.trim()
	if (!trimmed) return DEFAULT_STRIPE_SUCCESS_PATH

	// If success URL is set to the site root, force the thank-you page instead.
	const normalizedApp = appUrl.replace(/\/$/, '')
	const normalizedRaw = trimmed.replace(/\/$/, '')
	if (normalizedRaw === normalizedApp) return DEFAULT_STRIPE_SUCCESS_PATH

	const resolved = new URL(buildSameOriginReturnUrl(trimmed, appUrl, 'STRIPE_SUCCESS_URL'))
	if (resolved.pathname === '/') {
		return DEFAULT_STRIPE_SUCCESS_PATH
	}

	return trimmed
}

function normalizeStripeCancelUrl(raw: string, appUrl: string): string {
	const trimmed = raw.trim()
	if (!trimmed) return '/'
	buildSameOriginReturnUrl(trimmed, appUrl, 'STRIPE_CANCEL_URL')
	return trimmed
}

export const publicConfig = {
	app: {
		url: requireUrlEnvAny(['NEXT_PUBLIC_APP_URL', 'APP_PUBLIC_URL'], 'NEXT_PUBLIC_APP_URL'),
	},
} as const

export type ServerConfig = {
	app: { url: string }
	stripe: {
		secretKey: string
		pricePro: string
		priceProAnnual: string
		portalConfigurationId: string
		commitmentPortalConfigurationId: string | null
		successUrl: string
		cancelUrl: string
	}
	stripeWebhook: {
		secret: string
	}
	email: {
		resendApiKey: string
		from: string
		replyTo: string
		supportTo: string
		portalUrl: string
	}
	ops: {
		idempotencyTtlHours: number
	}
}

export type StripeConfig = {
	app: { url: string }
	stripe: {
		secretKey: string
		pricePro: string
		priceProAnnual: string
		portalConfigurationId: string
		commitmentPortalConfigurationId: string | null
		successUrl: string
		cancelUrl: string
	}
}

export type OpsConfig = {
	idempotencyTtlHours: number
}

let cachedStripeConfig: StripeConfig | null = null
let cachedOpsConfig: OpsConfig | null = null
let cachedServerConfig: ServerConfig | null = null

// Stripe-only server config. Lazy-loaded to avoid build-time env validation.
// Use this for checkout flows.
export function getStripeConfig(): StripeConfig {
	if (cachedStripeConfig) return cachedStripeConfig

	const appUrl = requireUrlEnvAny(['APP_PUBLIC_URL', 'NEXT_PUBLIC_APP_URL'], 'APP_PUBLIC_URL')
	const stripeConfig = getStripeModeConfig()
	const successUrl = normalizeStripeSuccessUrl(
		getEnvOrDefault('STRIPE_SUCCESS_URL', DEFAULT_STRIPE_SUCCESS_PATH),
		appUrl
	)
	const cancelUrl = normalizeStripeCancelUrl(getEnvOrDefault('STRIPE_CANCEL_URL', '/'), appUrl)

	cachedStripeConfig = {
		app: { url: appUrl },
		stripe: {
			secretKey: stripeConfig.secretKey,
			pricePro: stripeConfig.pricePro,
			priceProAnnual: stripeConfig.priceProAnnual,
			portalConfigurationId: stripeConfig.portalConfigurationId,
			commitmentPortalConfigurationId: stripeConfig.commitmentPortalConfigurationId,
			successUrl,
			cancelUrl,
		},
	}

	return cachedStripeConfig
}

export function getOpsConfig(): OpsConfig {
	if (cachedOpsConfig) return cachedOpsConfig
	cachedOpsConfig = {
		idempotencyTtlHours: requireNumberEnv('WEBHOOK_IDEMPOTENCY_TTL_HOURS'),
	}
	return cachedOpsConfig
}

// Full server config. Lazy-loaded to avoid build-time env validation.
// Use this in webhook, email, and billing projection paths.
export function getServerConfig(): ServerConfig {
	if (cachedServerConfig) {
		return cachedServerConfig
	}

	const appUrl = requireUrlEnvAny(['APP_PUBLIC_URL', 'NEXT_PUBLIC_APP_URL'], 'APP_PUBLIC_URL')
	const stripeConfig = getStripeModeConfig()
	const portalUrl = getEnvAny(['PORTAL_URL', 'PORTAL_LOGIN_URL'])
		? requireUrlEnvAny(['PORTAL_URL', 'PORTAL_LOGIN_URL'], 'PORTAL_URL')
		: `${appUrl}/portal`
	const resendFrom = getEnv('RESEND_FROM')

	cachedServerConfig = {
		app: { url: appUrl },
		stripe: {
			secretKey: stripeConfig.secretKey,
			pricePro: stripeConfig.pricePro,
			priceProAnnual: stripeConfig.priceProAnnual,
			portalConfigurationId: stripeConfig.portalConfigurationId,
			commitmentPortalConfigurationId: stripeConfig.commitmentPortalConfigurationId,
			successUrl: normalizeStripeSuccessUrl(
				getEnvOrDefault('STRIPE_SUCCESS_URL', DEFAULT_STRIPE_SUCCESS_PATH),
				appUrl
			),
			cancelUrl: normalizeStripeCancelUrl(getEnvOrDefault('STRIPE_CANCEL_URL', '/'), appUrl),
		},
		stripeWebhook: {
			secret: stripeConfig.webhookSecret,
		},
		email: {
			resendApiKey: requireEnv('RESEND_API_KEY'),
			from: resendFrom && resendFrom.trim() ? resendFrom : requireEnv('EMAIL_FROM'),
			replyTo: requireEnv('EMAIL_REPLY_TO'),
			supportTo: requireEnv('SUPPORT_TO_EMAIL'),
			portalUrl,
		},
		ops: getOpsConfig(),
	}

	return cachedServerConfig
}
