import assert from 'node:assert/strict'
import { shouldSendMembershipEmailForEvent } from '../src/lib/stripe-membership-email-gate'

function run(name: string, fn: () => void) {
	try {
		fn()
		console.log(`ok - ${name}`)
	} catch (error) {
		console.error(`fail - ${name}`)
		console.error(error)
		process.exitCode = 1
	}
}

run('allows checkout session completions for upgrade emails', () => {
	assert.equal(shouldSendMembershipEmailForEvent('checkout.session.completed'), true)
})

run('allows subscription updates for upgrade emails', () => {
	assert.equal(shouldSendMembershipEmailForEvent('customer.subscription.updated'), true)
})

run('blocks unrelated events from sending membership emails', () => {
	assert.equal(shouldSendMembershipEmailForEvent('invoice.payment_failed'), false)
	assert.equal(shouldSendMembershipEmailForEvent('customer.subscription.created'), false)
})
