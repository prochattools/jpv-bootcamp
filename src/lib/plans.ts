import 'server-only'
import { getStripeConfig } from '@/lib/stripe-config'

export type Plan = 'pro' | 'vip'

export function normalizePlan(value: string | null | undefined): Plan | null {
	if (!value) return null
	const normalized = value.trim().toLowerCase()
	return normalized === 'pro' || normalized === 'vip' ? normalized : null
}

let cachedPlanByPriceId: Record<string, Plan> | null = null

function getPlanByPriceId(): Record<string, Plan> {
	if (cachedPlanByPriceId) {
		return cachedPlanByPriceId
	}
	const { stripe } = getStripeConfig()
	cachedPlanByPriceId = {
		[stripe.pricePro]: 'pro',
		[stripe.priceVip]: 'vip',
	}
	return cachedPlanByPriceId
}

export function getPlanFromPriceId(priceId: string | null | undefined): Plan | null {
	if (!priceId) return null
	return getPlanByPriceId()[priceId] ?? null
}

export function resolvePlanFromStripe(params: {
	metadataPlan?: string | null
	priceId?: string | null
	productId?: string | null
}): Plan | null {
	const fromMetadata = normalizePlan(params.metadataPlan)
	if (fromMetadata) return fromMetadata
	const fromPrice = getPlanFromPriceId(params.priceId)
	if (fromPrice) return fromPrice
	return getPlanFromPriceId(params.productId)
}
