import assert from 'node:assert/strict'

import {
	buildSameOriginReturnUrl,
	getCheckoutPriceId,
	parseCheckoutPlan,
	resolveCheckoutBilling,
} from '../src/lib/stripe-checkout-config'

function main() {
	const prices = {
		pricePro: 'price_pro_monthly',
		priceProAnnual: 'price_pro_annual',
	}

	assert.equal(parseCheckoutPlan('pro'), 'pro')
	assert.equal(parseCheckoutPlan('PRO'), 'pro')
	assert.equal(parseCheckoutPlan(' pro '), 'pro')
	assert.equal(parseCheckoutPlan(null), null)
	assert.equal(parseCheckoutPlan(''), null)
	assert.equal(parseCheckoutPlan('vip'), null)
	assert.equal(parseCheckoutPlan('exhibitor'), null)
	assert.equal(parseCheckoutPlan('table'), null)
	assert.equal(parseCheckoutPlan('pro-table'), null)

	assert.equal(resolveCheckoutBilling('monthly'), 'monthly')
	assert.equal(resolveCheckoutBilling('annual'), 'annual')
	assert.equal(resolveCheckoutBilling('ANNUAL'), 'annual')
	assert.equal(resolveCheckoutBilling('daily'), 'monthly')
	assert.equal(resolveCheckoutBilling(null), 'monthly')

	assert.equal(getCheckoutPriceId('pro', 'monthly', prices), 'price_pro_monthly')
	assert.equal(getCheckoutPriceId('pro', 'annual', prices), 'price_pro_annual')

	assert.equal(
		buildSameOriginReturnUrl('/thank-you', 'https://preview.example.test', 'STRIPE_SUCCESS_URL'),
		'https://preview.example.test/thank-you'
	)
	assert.equal(
		buildSameOriginReturnUrl(
			'https://preview.example.test/thank-you?session_id=abc',
			'https://preview.example.test',
			'STRIPE_SUCCESS_URL'
		),
		'https://preview.example.test/thank-you?session_id=abc'
	)
	assert.throws(
		() =>
			buildSameOriginReturnUrl(
				'https://external.example.test/thank-you',
				'https://preview.example.test',
				'STRIPE_SUCCESS_URL'
			),
		/STRIPE_SUCCESS_URL must be same-origin with APP_PUBLIC_URL/
	)

	console.log('stripe checkout validation tests passed')
}

main()
