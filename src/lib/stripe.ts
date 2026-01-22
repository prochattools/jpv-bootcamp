import 'server-only'
import Stripe from 'stripe'

import { getStripeConfig } from '@/lib/stripe-config'

let cachedStripe: Stripe | null = null

export function getStripe(): Stripe {
	if (cachedStripe) return cachedStripe

	const cfg = getStripeConfig()

	cachedStripe = new Stripe(cfg.secretKey, {
		apiVersion: '2024-06-20',
	})

	return cachedStripe
}
