import assert from 'node:assert/strict'
import test from 'node:test'

import { MightyAdminApi, type MightyConfig } from './adminApi'

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

test('findMember follows Mighty pagination and compares normalized email', async () => {
	const requests: string[] = []
	const api = new MightyAdminApi(config, async (input) => {
		const url = String(input)
		requests.push(url)
		if (url.includes('page=2')) {
			return response({ items: [{ id: 44, email: 'Student@Example.com' }], links: {} })
		}
		return response({ items: [], links: { next: 'https://api.mn.co/admin/v1/networks/12345/members?page=2' } })
	})

	const member = await api.findMember(' student@example.com ')
	assert.equal(member?.id, 44)
	assert.equal(requests.length, 2)
})

test('createMember disables Mighty welcome email and grant uses the documented query parameter', async () => {
	const calls: Array<{ url: string; method: string; body?: string }> = []
	const api = new MightyAdminApi(config, async (input, init) => {
		calls.push({ url: String(input), method: init?.method ?? 'GET', body: init?.body as string | undefined })
		if (init?.method === 'POST' && String(input).includes('/members')) {
			return response({ id: 11, email: 'student@example.com' }, 201)
		}
		return response({ id: 678, name: 'JPV Access' })
	})

	await api.createMember({ email: 'student@example.com' })
	await api.grantAccess(11)

	assert.match(calls[0].body ?? '', /"send_welcome_email":false/)
	assert.match(calls[1].url, /\/plans\/678\/members\?user_id=11$/)
})

test('revokeAccess is immediate and treats an already absent purchase as idempotent', async () => {
	const api = new MightyAdminApi(config, async (_input, init) => {
		assert.equal(init?.method, 'DELETE')
		return response({}, 404)
	})

	const result = await api.revokeAccess(99, { immediate: true })
	assert.equal(result, null)
})
