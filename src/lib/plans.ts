import 'server-only'
import { getStripeConfig } from '@/lib/config'

export type Plan = 'pro' | 'vip'

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
