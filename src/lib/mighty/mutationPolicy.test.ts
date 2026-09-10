import assert from 'node:assert/strict'
import test from 'node:test'

import { assertMightyMutationAllowed, classifyMightyIdentity, getMightyMutationScope } from './mutationPolicy'

test('production scope fails closed without an explicit allowlist', () => {
	const scope = getMightyMutationScope({ MIGHTY_PROVIDER_ENV: 'production' })
	assert.equal(scope.enforce, true)
	assert.equal(scope.allowedEmails.size, 0)
	assert.throws(() => assertMightyMutationAllowed(scope, 'student@example.com', 'grant_plan'), (error: unknown) => error instanceof Error && 'code' in error && (error as { code?: string }).code === 'mighty_mutation_scope_denied')
})

test('explicit production test scope permits only the named test identity', () => {
	const scope = getMightyMutationScope({
		MIGHTY_PROVIDER_ENV: 'production',
		MIGHTY_PRODUCTION_ALLOW_API_MUTATIONS: 'true',
		MIGHTY_PRODUCTION_TEST_EMAIL: 'Student@Example.com',
		MIGHTY_IDENTITY_ROLE_OVERRIDES: 'Student@Example.com:ordinary',
	})
	assert.doesNotThrow(() => assertMightyMutationAllowed(scope, 'student@example.com', 'grant_plan'))
	assert.throws(() => assertMightyMutationAllowed(scope, 'other@example.com', 'grant_plan'), (error: unknown) => error instanceof Error && 'code' in error && (error as { code?: string }).code === 'mighty_mutation_scope_denied')
	assert.equal(scope.roleOverrides.get('student@example.com'), 'ordinary')
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
