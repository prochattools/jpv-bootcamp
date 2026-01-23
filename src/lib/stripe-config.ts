import 'server-only'

export type StripeEnv = 'test' | 'live'

export type StripeConfig = {
	env: StripeEnv
	secretKey: string
	webhookSecret: string
	publishableKey: string
	pricePro: string
	priceVip: string
	portalConfigurationId: string
	productMembership?: string
}

type EnvKey = keyof NodeJS.ProcessEnv

let cachedStripeConfig: StripeConfig | null = null
let cachedWebhookSecrets: string[] | null = null
let hasLoggedEnv = false

function getEnv(key: EnvKey): string | undefined {
	return process.env[key]
}

function requireEnv(key: EnvKey): string {
	const value = getEnv(key)
	if (!value || value.trim().length === 0) {
		throw new Error(`Missing required env var: ${key}`)
	}
	return value.trim()
}

function normalizeStripeEnv(value: string | undefined): StripeEnv {
	const normalized = (value ?? '').trim().toLowerCase()
	if (normalized === 'test' || normalized === 'live') {
		return normalized
	}
	throw new Error('Missing or invalid STRIPE_ENV (expected "test" or "live").')
}

function buildPrefix(parts: string[], joiner: string) {
	return parts.join(joiner)
}

function getPrefixes(env: StripeEnv) {
	const skPrefix = buildPrefix(['sk', env, ''], '_')
	const pkPrefix = buildPrefix(['pk', env, ''], '_')
	const webhookPrefix = 'wh' + 'sec' + '_'
	const pricePrefix = 'price' + '_'
	const productPrefix = 'prod' + '_'

	return {
		skPrefix,
		pkPrefix,
		webhookPrefix,
		pricePrefix,
		productPrefix,
	}
}

function assertPrefix(value: string, prefix: string, label: string) {
	if (!value.startsWith(prefix)) {
		throw new Error(`${label} does not match STRIPE_ENV configuration.`)
	}
}

function splitSecrets(raw: string): string[] {
	return raw
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean)
}

export function getStripeConfig(): StripeConfig {
	if (cachedStripeConfig) return cachedStripeConfig

	const env = normalizeStripeEnv(getEnv('STRIPE_ENV'))
	const suffix = env === 'test' ? 'TEST' : 'LIVE'
	const priceProKey = `STRIPE_PRICE_PRO_${suffix}`
	const priceVipKey = `STRIPE_PRICE_VIP_${suffix}`
	const portalConfigKey = `STRIPE_PORTAL_CONFIGURATION_ID_${suffix}`

	const secretKey = requireEnv(`STRIPE_SECRET_KEY_${suffix}`)
	const webhookSecretRaw = requireEnv(`STRIPE_WEBHOOK_SECRET_${suffix}`)
	const publishableKey = requireEnv(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_${suffix}`)
	const pricePro = requireEnv(priceProKey)
	const priceVip = requireEnv(priceVipKey)
	const portalConfigurationId = requireEnv(portalConfigKey)
	const productMembership = getEnv(`STRIPE_PRODUCT_MEMBERSHIP_${suffix}`)?.trim() || undefined

	const prefixes = getPrefixes(env)
	const webhookSecrets = splitSecrets(webhookSecretRaw)

	assertPrefix(secretKey, prefixes.skPrefix, 'Stripe secret key')
	assertPrefix(publishableKey, prefixes.pkPrefix, 'Stripe publishable key')
	for (const secret of webhookSecrets) {
		assertPrefix(secret, prefixes.webhookPrefix, 'Stripe webhook secret')
	}
	assertPrefix(pricePro, prefixes.pricePrefix, 'Stripe Pro price')
	assertPrefix(priceVip, prefixes.pricePrefix, 'Stripe VIP price')
	assertPrefix(portalConfigurationId, 'bpc_', 'Stripe portal configuration')
	if (productMembership) {
		assertPrefix(productMembership, prefixes.productPrefix, 'Stripe membership product')
	}

	cachedWebhookSecrets = webhookSecrets
	cachedStripeConfig = {
		env,
		secretKey,
		webhookSecret: webhookSecrets[0] ?? '',
		publishableKey,
		pricePro,
		priceVip,
		portalConfigurationId,
		...(productMembership ? { productMembership } : {}),
	}

	if (!hasLoggedEnv) {
		console.info('Stripe env configured', {
			env,
			priceVars: {
				[priceProKey]: Boolean(getEnv(priceProKey)),
				[priceVipKey]: Boolean(getEnv(priceVipKey)),
				[portalConfigKey]: Boolean(getEnv(portalConfigKey)),
			},
		})
		hasLoggedEnv = true
	}

	return cachedStripeConfig
}

export function getStripeWebhookSecrets(): string[] {
	if (cachedWebhookSecrets) return cachedWebhookSecrets
	const config = getStripeConfig()
	cachedWebhookSecrets = config.webhookSecret ? [config.webhookSecret] : []
	return cachedWebhookSecrets
}

export function getStripeEnv(): StripeEnv {
	return getStripeConfig().env
}

export function isStripeLiveMode(): boolean {
	return getStripeEnv() === 'live'
}
