import assert from 'node:assert/strict'
import test from 'node:test'

import { assertMightyMemberMatchesExpectedEmail, isDuplicatePlanAssignmentError, MightyAdminApi, MightyApiError, MightyMemberIdentityConflictError, MightyMemberIdentityError, type MightyConfig } from './adminApi'

const config: MightyConfig = {
	apiBaseUrl: 'https://api.mn.co/admin/v1',
	networkId: '12345',
	accessPlanId: 678,
	adminApiToken: 'test-token',
	studentLoginUrl: 'https://jpv-community.mn.co/sign_in',
}

function response(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'content-type': 'application/json' },
	})
}

test('findMember uses exact email lookup and never falls back to a network-wide scan', async () => {
	const requests: string[] = []
	const api = new MightyAdminApi(config, async (input) => {
		const url = String(input)
		requests.push(url)
		if (url.includes('/members/by_email')) return response({}, 404)
		throw new Error('network-wide member lookup must not be called')
	})

	const member = await api.findMember(' student@example.com ')
	assert.equal(member, null)
	assert.equal(requests.length, 1)
})

test('findMember prefers the exact-email lookup when the member is absent from the active list', async () => {
	const api = new MightyAdminApi(config, async (input) => {
		if (String(input).includes('/members/by_email')) {
			return response({ id: 44, email: 'student@example.com', member_type: 'full' })
		}
		throw new Error('active member list should not be queried after an exact match')
	})

	assert.deepEqual(await api.findMember(' Student@Example.com '), {
		id: 44,
		email: 'student@example.com',
		member_type: 'full',
		identityEvidence: {
			source: 'exact_by_email_lookup',
			requestedEmail: 'student@example.com',
		},
	})
})

test('findMemberByEmail uses Mighty exact-email lookup and treats absent members as null', async () => {
	let requestUrl = ''
	const api = new MightyAdminApi(config, async (input) => {
		requestUrl = String(input)
		return response({}, 404)
	})

	assert.equal(await api.findMemberByEmail(' Student@Example.com '), null)
	assert.match(requestUrl, /\/members\/by_email\?email=student%40example\.com$/)
})

test('member identity binding accepts a normalized provider email and rejects arbitrary masked members', () => {
	assert.doesNotThrow(() => assertMightyMemberMatchesExpectedEmail({ id: 1, email: '  STUDENT@Example.com ' }, 'student@example.com'))
	assert.throws(
		() => assertMightyMemberMatchesExpectedEmail({ id: 1, email: 'other@example.com' }, 'student@example.com'),
		(error: unknown) => error instanceof MightyMemberIdentityError && error.code === 'mighty_member_email_conflict',
	)
	for (const email of ['', '   ', null, undefined]) {
		assert.throws(
			() => assertMightyMemberMatchesExpectedEmail({ id: 1, email }, 'student@example.com'),
			(error: unknown) => error instanceof MightyMemberIdentityError && error.code === 'mighty_member_email_conflict',
		)
	}
	assert.doesNotThrow(() => assertMightyMemberMatchesExpectedEmail({
		id: 1,
		email: '',
		identityEvidence: { source: 'exact_by_email_lookup', requestedEmail: 'student@example.com' },
	}, 'student@example.com'))
})

test('exact by_email lookup accepts masked provider email with bound lookup evidence', async () => {
	for (const maskedEmail of ['', null, undefined]) {
		const api = new MightyAdminApi(config, async () => response({ id: 44, ...(maskedEmail === undefined ? {} : { email: maskedEmail }), member_type: 'full' }))
		const member = await api.findMemberByEmail(' Student@Example.com ')
		assert.equal(member?.id, 44)
		assert.equal(member?.email ?? '', '')
		assert.deepEqual(member?.identityEvidence, {
			source: 'exact_by_email_lookup',
			requestedEmail: 'student@example.com',
		})
	}
})

test('exact by_email lookup rejects a different non-empty provider email', async () => {
	const api = new MightyAdminApi(config, async () => response({ id: 44, email: 'other@example.com', member_type: 'full' }))
	await assert.rejects(
		() => api.findMember('student@example.com'),
		(error: unknown) => error instanceof MightyMemberIdentityError && error.code === 'mighty_member_email_conflict',
	)
})

test('provider requests include the required User-Agent header', async () => {
	let headers: HeadersInit | undefined
	const api = new MightyAdminApi(config, async (_input, init) => {
		headers = init?.headers
		return response({}, 404)
	})

	await api.findMember('student@example.com')
	assert.equal(new Headers(headers).get('User-Agent'), 'jpv-bootcamp-mighty-sync/1.0 (+https://jpvbootcamp.com)')
})

test('createMember disables Mighty welcome email and grant uses the documented query parameter', async () => {
	const calls: Array<{ url: string; method: string; body?: string }> = []
	const api = new MightyAdminApi(config, async (input, init) => {
		calls.push({ url: String(input), method: init?.method ?? 'GET', body: init?.body as string | undefined })
		if (init?.method === 'POST' && String(input).endsWith('/members')) {
			return response({ id: 11, email: 'student@example.com' }, 201)
		}
		return response({ id: 678, name: 'JPV Access' })
	})

	await api.createMember({ email: 'student@example.com' })
	await api.grantAccess(11)

	assert.match(calls[0].body ?? '', /"member_type":"full"/)
	assert.match(calls[0].body ?? '', /"send_welcome_email":false/)
	assert.match(calls[1].url, /\/plans\/678\/members\?user_id=11$/)
})

test('createMember verifies a masked creation response through exact by_email and preserves the provider email', async () => {
	const calls: string[] = []
	const api = new MightyAdminApi(config, async (input, init) => {
		calls.push(`${init?.method ?? 'GET'} ${String(input)}`)
		if (init?.method === 'POST') return response({ id: 41580317, email: '' }, 201)
		return response({ id: 41580317, email: null, member_type: 'full' })
	})

	const member = await api.createMember({ email: 'westhoek@hotmail.com' })
	assert.equal(member.id, 41580317)
	assert.equal(member.email, null)
	assert.deepEqual(member.identityEvidence, {
		source: 'exact_by_email_lookup',
		requestedEmail: 'westhoek@hotmail.com',
	})
	assert.equal(calls.length, 2)
	assert.match(calls[1], /\/members\/by_email\?email=westhoek%40hotmail\.com$/)
})

test('createMember rejects a masked response when exact lookup returns a different member ID', async () => {
	const api = new MightyAdminApi(config, async (_input, init) => {
		if (init?.method === 'POST') return response({ id: 41580317, email: '' }, 201)
		return response({ id: 99, email: '' })
	})

	await assert.rejects(
		() => api.createMember({ email: 'westhoek@hotmail.com' }),
		(error: unknown) => error instanceof MightyMemberIdentityConflictError && error.code === 'mighty_member_identity_conflict',
	)
})

test('createMember rejects an identity-mismatched provider response before any later grant', async () => {
	let grantCalls = 0
	const api = new MightyAdminApi(config, async (_input, init) => {
		if (init?.method === 'POST' && String(_input).includes('/members')) return response({ id: 11, email: 'other@example.com' }, 201)
		grantCalls += 1
		return response({ id: 678 })
	})

	await assert.rejects(() => api.createMember({ email: 'student@example.com' }), /mighty_member_email_conflict/)
	assert.equal(grantCalls, 0)
})

test('revokeAccess is immediate and treats an already absent purchase as idempotent', async () => {
	const api = new MightyAdminApi(config, async (_input, init) => {
		assert.equal(init?.method, 'DELETE')
		return response({}, 404)
	})

	const result = await api.revokeAccess(99, { immediate: true })
	assert.equal(result, null)
})

test('getAccessState reports the current plan purchase state', async () => {
	const api = new MightyAdminApi(config, async (input) => {
		if (String(input).includes('/members/11/plans')) return response({ items: [], links: {} })
		return response({ items: [{ member_id: 11, purchase: { id: 'purchase-1' } }], links: {} })
	})

	const state = await api.getAccessState(11, 678)
	assert.deepEqual(state, {
		memberId: '11',
		planId: '678',
		purchases: [{ member_id: 11, purchase: { id: 'purchase-1' } }],
		plans: [],
		memberPlanAccess: false,
		hasAccess: true,
	})
})

test('getAccessState reports direct nonpaid plan membership as access', async () => {
	const api = new MightyAdminApi(config, async (input) => {
		if (String(input).includes('/members/11/plans')) return response({ items: [{ id: 678 }], links: {} })
		return response({ items: [], links: {} })
	})

	assert.deepEqual(await api.getAccessState(11, 678), {
		memberId: '11',
		planId: '678',
		purchases: [],
		plans: [{ id: 678 }],
		memberPlanAccess: true,
		hasAccess: true,
	})
})

test('getAccessState treats an inactive member 404 as no access', async () => {
	const api = new MightyAdminApi(config, async () => response({}, 404))

	assert.deepEqual(await api.getAccessState(11, 678), {
		memberId: '11',
		planId: '678',
		purchases: [],
		plans: [],
		memberPlanAccess: false,
		hasAccess: false,
	})
})

test('listMemberSpaces returns the member Space memberships and treats inactive members as empty', async () => {
	let requestUrl = ''
	const api = new MightyAdminApi(config, async (input) => {
		requestUrl = String(input)
		return response({ items: [{ id: 1 }, { id: 2 }], links: {} })
	})

	assert.deepEqual(await api.listMemberSpaces(11), [{ id: 1 }, { id: 2 }])
	assert.match(requestUrl, /\/members\/11\/spaces\?per_page=100$/)
})

test('revokePlanAccess uses the documented plan-member DELETE endpoint', async () => {
	let requestUrl = ''
	const api = new MightyAdminApi(config, async (input, init) => {
		requestUrl = String(input)
		assert.equal(init?.method, 'DELETE')
		return response({}, 404)
	})

	await api.revokePlanAccess(11, 678)
	assert.match(requestUrl, /\/plans\/678\/members\/11\/$/)
})

test('422 duplicate Plan assignment is recognized only with duplicate provider evidence', async () => {
	const duplicateApi = new MightyAdminApi(config, async () => response({ error: { code: 'duplicate_assignment', message: 'member already has this Plan' } }, 422))
	await assert.rejects(() => duplicateApi.grantAccess(11), (error: unknown) => isDuplicatePlanAssignmentError(error))
	assert.equal(isDuplicatePlanAssignmentError(new MightyApiError(422)), false)
	const unrelated = new MightyApiError(422, { code: 'validation_error', message: 'invalid member state' })
	assert.equal(isDuplicatePlanAssignmentError(unrelated), false)
})

test('provider failure statuses remain typed and do not expose raw response bodies', async () => {
	for (const status of [400, 401, 403, 429, 500]) {
		const api = new MightyAdminApi(config, async () => response({ error: { code: `provider_${status}`, message: 'provider failure' } }, status))
		await assert.rejects(() => api.findMemberByEmail('student@example.com'), (error: unknown) => {
			assert.ok(error instanceof MightyApiError)
			assert.equal(error.status, status)
			assert.equal(error.providerCode, `provider_${status}`)
			assert.equal(error.providerMessage, 'provider failure')
			assert.doesNotMatch(error.message, /provider failure/)
			return true
		})
	}

	const malformedApi = new MightyAdminApi(config, async () => new Response('{not-json', { status: 500 }))
	await assert.rejects(() => malformedApi.findMemberByEmail('student@example.com'), (error: unknown) => {
		assert.ok(error instanceof MightyApiError)
		assert.equal(error.status, 500)
		assert.equal(error.providerCode, null)
		assert.equal(error.providerMessage, null)
		assert.equal(error.message, 'mighty_api_error_500')
		return true
	})
})
