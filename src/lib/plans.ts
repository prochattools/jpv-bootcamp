import 'server-only'
import { config } from '@/lib/config'

export type Plan = 'pro' | 'vip'

const PLAN_BY_PRICE_ID: Record<string, Plan> = {
	[config.stripe.pricePro]: 'pro',
	[config.stripe.priceVip]: 'vip',
}

export function getPlanFromPriceId(priceId: string | null | undefined): Plan | null {
	if (!priceId) return null
	return PLAN_BY_PRICE_ID[priceId] ?? null
}


export function getWpRoleForPlan(plan: Plan): string {
	if (plan === 'vip') {
		return config.wp.roleVip || config.wp.roleDefault
	}
	return config.wp.rolePro || config.wp.roleDefault
}
