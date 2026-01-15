import 'server-only'

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

function requireUrlEnv(key: EnvKey): string {
	const value = requireEnv(key)
	try {
		new URL(value)
	} catch {
		throw new Error(`Invalid URL for env var: ${key}`)
	}
	return value.replace(/\/$/, '')
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
		priceVip: string
		successUrl: string
		cancelUrl: string
	}
	stripeWebhook: {
		secret: string
	}
	wp: {
		baseUrl: string
		provisionEndpoint: string
		provisionToken: string
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
		priceVip: string
		successUrl: string
		cancelUrl: string
	}
}

export type OpsConfig = {
	idempotencyTtlHours: number
}

let cachedStripeWebhookSecret: string | null = null
let cachedStripeConfig: StripeConfig | null = null
let cachedOpsConfig: OpsConfig | null = null
let cachedServerConfig: ServerConfig | null = null

// Stripe-only server config. Lazy-loaded to avoid build-time env validation.
// Use this for checkout flows; WP provisioning should happen on webhook.
export function getStripeConfig(): StripeConfig {
	if (cachedStripeConfig) return cachedStripeConfig

	const appUrl = requireUrlEnvAny(['APP_PUBLIC_URL', 'NEXT_PUBLIC_APP_URL'], 'APP_PUBLIC_URL')
	const stripePricePro = requireEnvAny(
		['STRIPE_PRICE_PRO', 'NEXT_PUBLIC_STRIPE_PRICE_PRO'],
		'STRIPE_PRICE_PRO'
	)
	const stripePriceVip = requireEnvAny(
		['STRIPE_PRICE_VIP', 'NEXT_PUBLIC_STRIPE_PRICE_VIP'],
		'STRIPE_PRICE_VIP'
	)
	const successUrl = getEnvOrDefault(
		'STRIPE_SUCCESS_URL',
		'/thank-you?session_id={CHECKOUT_SESSION_ID}'
	)
	const cancelUrl = getEnvOrDefault('STRIPE_CANCEL_URL', '/')

	cachedStripeConfig = {
		app: { url: appUrl },
		stripe: {
			secretKey: requireEnv('STRIPE_SECRET_KEY'),
			pricePro: stripePricePro,
			priceVip: stripePriceVip,
			successUrl,
			cancelUrl,
		},
	}

	return cachedStripeConfig
}

export function getStripeWebhookSecret(): string {
	if (cachedStripeWebhookSecret) return cachedStripeWebhookSecret
	cachedStripeWebhookSecret = requireEnv('STRIPE_WEBHOOK_SECRET')
	return cachedStripeWebhookSecret
}

export function getOpsConfig(): OpsConfig {
	if (cachedOpsConfig) return cachedOpsConfig
	cachedOpsConfig = {
		idempotencyTtlHours: requireNumberEnv('WEBHOOK_IDEMPOTENCY_TTL_HOURS'),
	}
	return cachedOpsConfig
}

// Full server config (includes WP). Lazy-loaded to avoid build-time env validation.
// Use this in webhook/provisioning paths.
export function getServerConfig(): ServerConfig {
	if (cachedServerConfig) {
		return cachedServerConfig
	}

	const appUrl = requireUrlEnvAny(['APP_PUBLIC_URL', 'NEXT_PUBLIC_APP_URL'], 'APP_PUBLIC_URL')
	const stripePricePro = requireEnvAny(
		['STRIPE_PRICE_PRO', 'NEXT_PUBLIC_STRIPE_PRICE_PRO'],
		'STRIPE_PRICE_PRO'
	)
	const stripePriceVip = requireEnvAny(
		['STRIPE_PRICE_VIP', 'NEXT_PUBLIC_STRIPE_PRICE_VIP'],
		'STRIPE_PRICE_VIP'
	)
	const portalUrl = requireUrlEnvAny(['PORTAL_URL', 'PORTAL_LOGIN_URL'], 'PORTAL_URL')
	const resendFrom = getEnv('RESEND_FROM')

	cachedServerConfig = {
		app: { url: appUrl },
		stripe: {
			secretKey: requireEnv('STRIPE_SECRET_KEY'),
			pricePro: stripePricePro,
			priceVip: stripePriceVip,
			successUrl: getEnvOrDefault(
				'STRIPE_SUCCESS_URL',
				'/thank-you?session_id={CHECKOUT_SESSION_ID}'
			),
			cancelUrl: getEnvOrDefault('STRIPE_CANCEL_URL', '/'),
		},
		stripeWebhook: {
			secret: requireEnv('STRIPE_WEBHOOK_SECRET'),
		},
		wp: {
			baseUrl: requireUrlEnv('WP_BASE_URL'),
			provisionEndpoint: requireEnv('WP_PROVISION_ENDPOINT'),
			provisionToken: requireEnv('WP_PROVISION_TOKEN'),
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
