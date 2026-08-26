import 'server-only'
import { getStripeConfig } from '@/lib/stripe-config'

export type Plan = 'jpv_bootcamp_membership'

export function normalizePlan(value: string | null | undefined): Plan | null {
	if (!value) return null
	const normalized = value.trim().toLowerCase()
	// Accept the canonical key and legacy aliases for import compatibility
	if (
		normalized === 'jpv_bootcamp_membership' ||
		normalized === 'membership' ||
		normalized === 'pro'
	) {
		return 'jpv_bootcamp_membership'
	}
	return null
}

let cachedPlanByPriceId: Record<string, Plan> | null = null
let cachedPlanByProductId: Record<string, Plan> | null = null

function getPlanByPriceId(): Record<string, Plan> {
	if (cachedPlanByPriceId) return cachedPlanByPriceId
	const { pricePro, priceProAnnual } = getStripeConfig()
	cachedPlanByPriceId = {
		[pricePro]: 'jpv_bootcamp_membership',
		[priceProAnnual]: 'jpv_bootcamp_membership',
	}
	return cachedPlanByPriceId
}

function getPlanByProductId(): Record<string, Plan> {
	if (cachedPlanByProductId) return cachedPlanByProductId
	const { productPro } = getStripeConfig()
	cachedPlanByProductId = {
		[productPro]: 'jpv_bootcamp_membership',
	}
	return cachedPlanByProductId
}

export function getPlanFromPriceId(priceId: string | null | undefined): Plan | null {
	if (!priceId) return null
	return getPlanByPriceId()[priceId] ?? null
}

export function getPlanFromProductId(productId: string | null | undefined): Plan | null {
	if (!productId) return null
	return getPlanByProductId()[productId] ?? null
}

export function resolvePlanFromStripe(params: {
	metadataPlan?: string | null
	priceId?: string | null
	productId?: string | null
}): Plan | null {
	const fromPrice = getPlanFromPriceId(params.priceId)
	if (fromPrice) return fromPrice
	const hasPrice = params.priceId !== null && params.priceId !== undefined
	if (hasPrice) return null
	const fromProduct = getPlanFromProductId(params.productId)
	if (fromProduct) return fromProduct
	return normalizePlan(params.metadataPlan)
}
