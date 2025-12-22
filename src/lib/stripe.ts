import 'server-only'
import Stripe from 'stripe'
import { config } from '@/lib/config'

let stripeClient: Stripe | null = null

export function getStripe() {
	if (!stripeClient) {
		stripeClient = new Stripe(config.stripe.secretKey, {
			apiVersion: '2024-06-20',
		})
	}

	return stripeClient
}
