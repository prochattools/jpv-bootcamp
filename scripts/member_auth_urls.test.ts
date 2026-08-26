import assert from 'node:assert/strict'

import { buildMemberForgotPasswordUrl } from '../src/lib/memberAuthUrls'

assert.equal(
	buildMemberForgotPasswordUrl('https://jpvbootcamp.com/portal'),
	'https://jpvbootcamp.com/forgot-password',
)
assert.equal(
	buildMemberForgotPasswordUrl('https://jpvbootcamp.com/portal/'),
	'https://jpvbootcamp.com/forgot-password',
)
assert.equal(
	buildMemberForgotPasswordUrl('https://jpvbootcamp.com/portal?source=email#reset'),
	'https://jpvbootcamp.com/forgot-password',
)
assert.equal(
	buildMemberForgotPasswordUrl('https://jpvbootcamp.com'),
	'https://jpvbootcamp.com/forgot-password',
)

console.log('member auth URL tests passed')
