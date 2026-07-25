import 'server-only'

export type StripeEnv = 'test' | 'live'

export type StripeConfig = {
	env: StripeEnv
	secretKey: string
	webhookSecret: string
	publishableKey: string
	pricePro: string
	priceProAnnual: string
	productPro: string
	portalConfigurationId: string
	commitmentPortalConfigurationId: string | null
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
	const priceMonthlyKey = `STRIPE_PRICE_MONTHLY_${suffix}`
	const priceAnnuallyKey = `STRIPE_PRICE_ANNUALLY_${suffix}`
	const productKey = `STRIPE_PRODUCT_JPV_BOOTCAMP_MEMBERSHIP_${suffix}`
	const portalConfigKey = `STRIPE_PORTAL_CONFIGURATION_ID_${suffix}`
	const commitmentPortalConfigKey = `STRIPE_PORTAL_COMMITMENT_CONFIGURATION_ID_${suffix}`

	const secretKey = requireEnv(`STRIPE_SECRET_KEY_${suffix}`)
	const webhookSecretRaw = requireEnv(`STRIPE_WEBHOOK_SECRET_${suffix}`)
	const publishableKey = requireEnv(`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_${suffix}`)

	const pricePro = requireEnv(priceMonthlyKey)
	const priceProAnnual = requireEnv(priceAnnuallyKey)
	const productPro = requireEnv(productKey)
	const portalConfigurationId = requireEnv(portalConfigKey)
	const commitmentPortalConfigurationId = getEnv(commitmentPortalConfigKey)?.trim() || null

	const prefixes = getPrefixes(env)
	const webhookSecrets = splitSecrets(webhookSecretRaw)

	assertPrefix(secretKey, prefixes.skPrefix, 'Stripe secret key')
	assertPrefix(publishableKey, prefixes.pkPrefix, 'Stripe publishable key')
	for (const secret of webhookSecrets) {
		assertPrefix(secret, prefixes.webhookPrefix, 'Stripe webhook secret')
	}
	assertPrefix(pricePro, prefixes.pricePrefix, 'Stripe Pro monthly price')
	assertPrefix(priceProAnnual, prefixes.pricePrefix, 'Stripe Pro annual price')
	assertPrefix(productPro, prefixes.productPrefix, 'Stripe Pro product')
	assertPrefix(portalConfigurationId, 'bpc_', 'Stripe portal configuration')
	if (commitmentPortalConfigurationId) {
		assertPrefix(
			commitmentPortalConfigurationId,
			'bpc_',
			'Stripe commitment portal configuration',
		)
	}

	cachedWebhookSecrets = webhookSecrets
	cachedStripeConfig = {
		env,
		secretKey,
		webhookSecret: webhookSecrets[0] ?? '',
		publishableKey,
		pricePro,
		priceProAnnual,
		productPro,
		portalConfigurationId,
		commitmentPortalConfigurationId,
	}

	if (!hasLoggedEnv) {
		console.info('Stripe env configured', {
			stripeEnv: env,
			varsPresent: {
				[priceMonthlyKey]: Boolean(getEnv(priceMonthlyKey)),
				[priceAnnuallyKey]: Boolean(getEnv(priceAnnuallyKey)),
				[productKey]: Boolean(getEnv(productKey)),
				[portalConfigKey]: Boolean(getEnv(portalConfigKey)),
				[commitmentPortalConfigKey]: Boolean(getEnv(commitmentPortalConfigKey)),
			},
		})
		hasLoggedEnv = true
	}

	return cachedStripeConfig
}

export function getStripeWebhookSecrets(): string[] {
	if (cachedWebhookSecrets) return cachedWebhookSecrets
	getStripeConfig()
	return cachedWebhookSecrets ?? []
}

export function getStripeEnv(): StripeEnv {
	return getStripeConfig().env
}
