import assert from 'node:assert/strict'
import test from 'node:test'

import { assertMightyMutationAllowed, AUTHORIZED_MIGHTY_LIVE_TEST_EMAILS, classifyMightyIdentity, getMightyMutationScope } from './mutationPolicy'

test('production scope fails closed without an explicit allowlist', () => {
	const scope = getMightyMutationScope({ MIGHTY_PROVIDER_ENV: 'production' })
	assert.equal(scope.enforce, true)
	assert.equal(scope.allowedEmails.size, 0)
	assert.throws(() => assertMightyMutationAllowed(scope, 'student@example.com', 'grant_plan'), (error: unknown) => error instanceof Error && 'code' in error && (error as { code?: string }).code === 'mighty_mutation_scope_denied')
})

test('production engineering scope permits only the fixed three-account allowlist', () => {
	const scope = getMightyMutationScope({
		MIGHTY_PROVIDER_ENV: 'production',
		MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS: 'true',
		MIGHTY_PRODUCTION_TEST_EMAIL: 'westhoek@hotmail.com',
		MIGHTY_ACCESS_SYNC_MUTATION_ALLOWLIST: 'westhoek@hotmail.com,steve@yeshua.academy,info@prochat.tools,student@example.com',
	})
	assert.equal(scope.liveTestOnly, true)
	assert.deepEqual([...scope.allowedEmails].sort(), [...AUTHORIZED_MIGHTY_LIVE_TEST_EMAILS].sort())
	for (const email of AUTHORIZED_MIGHTY_LIVE_TEST_EMAILS) {
		assert.doesNotThrow(() => assertMightyMutationAllowed(scope, email, 'grant_plan'))
	}
	assert.throws(() => assertMightyMutationAllowed(scope, 'student@example.com', 'grant_plan'), (error: unknown) => error instanceof Error && 'code' in error && ['mighty_live_test_scope_denied', 'mighty_mutation_scope_denied'].includes((error as { code?: string }).code ?? ''))
})

test('production engineering scope can be explicitly lifted only for a future authorized phase', () => {
	const scope = getMightyMutationScope({
		MIGHTY_PROVIDER_ENV: 'production',
		MIGHTY_PRODUCTION_ENGINEERING_ONLY: 'false',
		MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS: 'true',
		MIGHTY_PRODUCTION_TEST_EMAIL: 'student@example.com',
	})
	assert.equal(scope.liveTestOnly, false)
	assert.doesNotThrow(() => assertMightyMutationAllowed(scope, 'student@example.com', 'grant_plan'))
})

test('provider role and explicit operator override classify privileged identities', () => {
	const scope = getMightyMutationScope({})
	assert.equal(classifyMightyIdentity({
		email: 'host@example.com',
		member: { id: 1, email: 'host@example.com', role: 'host' },
		spaces: [],
		plans: [],
		scope,
	}), 'host')
	const overrideScope = getMightyMutationScope({ MIGHTY_IDENTITY_ROLE_OVERRIDES: 'admin@example.com:administrator' })
	assert.equal(classifyMightyIdentity({
		email: 'admin@example.com',
		member: { id: 2, email: '', role: null },
		spaces: [],
		plans: [],
		scope: overrideScope,
	}), 'administrator')
})

test('missing provider role is review, not inferred ordinary access', () => {
	const scope = getMightyMutationScope({})
	assert.equal(classifyMightyIdentity({
		email: 'student@example.com',
		member: { id: 3, email: 's***@***.***', role: null },
		spaces: [{ id: 1, name: 'Activity Feed' }],
		plans: [],
		scope,
	}), 'review')
})
