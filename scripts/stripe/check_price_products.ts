import Stripe from 'stripe'
import { getStripeConfig } from '../../src/lib/stripe-config'

async function run(): Promise<void> {
	const stripeConfig = getStripeConfig()
	const stripe = new Stripe(stripeConfig.secretKey, { apiVersion: '2024-06-20' })

	const monthlyPriceId = stripeConfig.pricePro
	const annualPriceId = stripeConfig.priceProAnnual

	const [monthlyPrice, annualPrice] = await Promise.all([
		stripe.prices.retrieve(monthlyPriceId),
		stripe.prices.retrieve(annualPriceId),
	])

	const monthlyProductId =
		typeof monthlyPrice.product === 'string' ? monthlyPrice.product : monthlyPrice.product?.id ?? null
	const annualProductId =
		typeof annualPrice.product === 'string' ? annualPrice.product : annualPrice.product?.id ?? null

	if (!monthlyProductId || !annualProductId) {
		console.error('Missing product id on Stripe price.', {
			monthlyPriceId,
			annualPriceId,
			monthlyProductId,
			annualProductId,
		})
		process.exit(1)
	}

	if (monthlyProductId !== annualProductId) {
		console.error('Pro monthly and annual prices must point to the same Stripe product.', {
			monthlyPriceId,
			annualPriceId,
			monthlyProductId,
			annualProductId,
		})
		process.exit(1)
	}

	console.log('Stripe Pro price/product check passed.', {
		monthlyPriceId,
		annualPriceId,
		productId: monthlyProductId,
	})
}

run().catch((error) => {
	console.error(error)
	process.exit(1)
})
