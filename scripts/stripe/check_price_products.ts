import Stripe from 'stripe'
import { getStripeConfig } from '../../src/lib/stripe-config'

async function run(): Promise<void> {
	const stripeConfig = getStripeConfig()
	const stripe = new Stripe(stripeConfig.secretKey, { apiVersion: '2024-06-20' })

	const proPriceId = stripeConfig.pricePro
	const vipPriceId = stripeConfig.priceVip

	const [proPrice, vipPrice] = await Promise.all([
		stripe.prices.retrieve(proPriceId),
		stripe.prices.retrieve(vipPriceId),
	])

	const proProductId =
		typeof proPrice.product === 'string' ? proPrice.product : proPrice.product?.id ?? null
	const vipProductId =
		typeof vipPrice.product === 'string' ? vipPrice.product : vipPrice.product?.id ?? null

	if (!proProductId || !vipProductId) {
		console.error('Missing product id on Stripe price.', {
			proPriceId,
			vipPriceId,
			proProductId,
			vipProductId,
		})
		process.exit(1)
	}

	if (proProductId === vipProductId) {
		console.error('Pro and VIP prices must point to different Stripe products.', {
			proPriceId,
			vipPriceId,
			proProductId,
			vipProductId,
		})
		process.exit(1)
	}

	console.log('OK: Pro and VIP prices point to different products.', {
		stripeEnv: stripeConfig.env,
		proPriceId,
		vipPriceId,
		proProductId,
		vipProductId,
	})
}

run().catch((error) => {
	console.error('Stripe price/product check failed.', {
		message: (error as Error).message ?? 'unknown_error',
	})
	process.exit(1)
})
