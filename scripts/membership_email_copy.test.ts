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

run('renders generic membership update copy without legacy plan names', () => {
	assert.equal(
		getMembershipEmailIntro({ plan: 'jpv_bootcamp_membership', variant: 'upgrade' }),
		'Your JPV Bootcamp membership has been updated.'
	)
})

run('keeps welcome copy separate from upgrade copy', () => {
	assert.equal(
		getMembershipEmailIntro({ plan: 'jpv_bootcamp_membership', variant: 'welcome' }),
		'Your JPV Bootcamp account is activated. Here are your login details.'
	)
})

run('renders html copy without legacy plan names', () => {
	assert.equal(
		getMembershipEmailIntroHtml({ plan: 'jpv_bootcamp_membership', variant: 'upgrade' }),
		'Your JPV Bootcamp membership has been updated.'
	)
})
