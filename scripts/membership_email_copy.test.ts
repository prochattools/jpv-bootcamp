import assert from 'node:assert/strict'
import {
	getMembershipEmailIntro,
	getMembershipEmailIntroHtml,
} from '../src/lib/membership-email-copy'

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

run('renders the pro upgrade confirmation copy', () => {
	assert.equal(
		getMembershipEmailIntro({ plan: 'pro', variant: 'upgrade' }),
		"You've been upgraded to Pro."
	)
})

run('renders the vip upgrade confirmation copy', () => {
	assert.equal(
		getMembershipEmailIntro({ plan: 'vip', variant: 'upgrade' }),
		"You've been upgraded to VIP."
	)
})

run('keeps welcome copy separate from upgrade copy', () => {
	assert.equal(
		getMembershipEmailIntro({ plan: 'pro', variant: 'welcome' }),
		'Your Pro plan is active.'
	)
	assert.equal(
		getMembershipEmailIntro({ plan: 'vip', variant: 'welcome' }),
		'Your VIP plan is active.'
	)
})

run('renders bold html for the upgrade copy', () => {
	assert.equal(
		getMembershipEmailIntroHtml({ plan: 'pro', variant: 'upgrade' }),
		"You've been upgraded to <strong>Pro</strong>."
	)
	assert.equal(
		getMembershipEmailIntroHtml({ plan: 'vip', variant: 'upgrade' }),
		"You've been upgraded to <strong>VIP</strong>."
	)
})
