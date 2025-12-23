import 'server-only'

type EnvKey = keyof NodeJS.ProcessEnv


function getEnv(key: EnvKey): string | undefined {
	return process.env[key]
}

function requireEnv(key: EnvKey): string {
	const value = getEnv(key)
	if (!value) {
		throw new Error(`Missing required env var: ${key}`)
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

const appUrl = requireUrlEnv('NEXT_PUBLIC_APP_URL')
const stripePricePro = requireEnv('NEXT_PUBLIC_STRIPE_PRICE_PRO')
const stripePriceVip = requireEnv('NEXT_PUBLIC_STRIPE_PRICE_VIP')
const portalLoginUrl = requireEnv('PORTAL_LOGIN_URL')
const portalSetPasswordUrl = requireEnv('PORTAL_SET_PASSWORD_URL')

export const config = {
	app: { url: appUrl },
	stripe: {
		secretKey: requireEnv('STRIPE_SECRET_KEY'),
		webhookSecret: requireEnv('STRIPE_WEBHOOK_SECRET'),
		pricePro: stripePricePro,
		priceVip: stripePriceVip,
		successUrl: requireEnv('STRIPE_SUCCESS_URL'),
		cancelUrl: requireEnv('STRIPE_CANCEL_URL'),
	},
	wp: {
		baseUrl: requireUrlEnv('WP_BASE_URL'),
		username: requireEnv('WP_ADMIN_USERNAME'),
		appPassword: requireEnv('WP_APPLICATION_PASSWORD'),
		rolePro: getEnv('WP_ROLE_PRO'),
		roleVip: getEnv('WP_ROLE_VIP'),
		roleDefault: requireEnv('WP_ROLE_DEFAULT'),
	},
	email: {
		resendApiKey: requireEnv('RESEND_API_KEY'),
		from: requireEnv('EMAIL_FROM'),
		replyTo: requireEnv('EMAIL_REPLY_TO'),
		portalLoginUrl,
		portalSetPasswordUrl,
	},
	ops: {
		idempotencyTtlHours: requireNumberEnv('WEBHOOK_IDEMPOTENCY_TTL_HOURS'),
	},
} as const

export const publicConfig = {
	app: { url: appUrl },
	stripe: {
		pricePro: stripePricePro,
		priceVip: stripePriceVip,
	},
	email: {
		portalLoginUrl,
		portalSetPasswordUrl,
	},
} as const
