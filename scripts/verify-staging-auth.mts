#!/usr/bin/env tsx
/**
 * Staging auth/onboarding verification for real flows
 * Tests: admin login, member login/logout, email, Checkout
 */

import https from 'https'
import { URL } from 'url'
import { ENVIRONMENT_TOPOLOGY } from '../src/lib/environmentTopology'

const STAGING_URL = ENVIRONMENT_TOPOLOGY.staging.origin

interface TestResult {
	name: string
	passed: boolean
	status?: number
	body?: string
	error?: string
}

const results: TestResult[] = []

async function makeRequest(
	method: 'GET' | 'POST',
	path: string,
	body?: string,
	headers?: Record<string, string>,
	opts?: { followRedirect?: boolean }
): Promise<{ status: number; body: string; headers: Record<string, any> }> {
	return new Promise((resolve, reject) => {
		const url = new URL(path, STAGING_URL)
		const options = {
			method,
			hostname: url.hostname,
			port: url.port || 443,
			path: url.pathname + url.search,
			headers: {
				'user-agent': 'Mozilla/5.0',
				...headers,
			},
		}

		const req = https.request(options, (res) => {
			let data = ''
			res.on('data', (chunk) => (data += chunk))
			res.on('end', () => resolve({ status: res.statusCode || 500, body: data, headers: res.headers }))
		})

		req.on('error', reject)
		if (body) req.write(body)
		req.end()
	})
}

async function testSignInPageReachable(): Promise<void> {
	try {
		const { status, body } = await makeRequest('GET', '/sign-in')
		const passed = status === 200 && body.includes('sign-in')
		results.push({
			name: 'Sign-in page reachable',
			passed,
			status,
			body: passed ? '✓ HTML received' : `Unexpected response`,
		})
	} catch (err) {
		results.push({
			name: 'Sign-in page reachable',
			passed: false,
			error: String(err),
		})
	}
}

async function testPortalPageProtected(): Promise<void> {
	try {
		const { status } = await makeRequest('GET', '/portal')
		// Should redirect to /sign-in (301/302) or return 401
		const passed = status === 301 || status === 302 || status === 401
		results.push({
			name: 'Portal page protected (redirects to sign-in)',
			passed,
			status,
		})
	} catch (err) {
		results.push({
			name: 'Portal page protected',
			passed: false,
			error: String(err),
		})
	}
}

async function testAdminPageProtected(): Promise<void> {
	try {
		const { status } = await makeRequest('GET', '/admin')
		// Should redirect or return 401/403
		const passed = status === 301 || status === 302 || status === 401 || status === 403
		results.push({
			name: 'Admin page protected',
			passed,
			status,
		})
	} catch (err) {
		results.push({
			name: 'Admin page protected',
			passed: false,
			error: String(err),
		})
	}
}

async function testRegisterPageExists(): Promise<void> {
	try {
		const { status } = await makeRequest('GET', '/register')
		// Register page might be 410 Gone or 200 (depending on config)
		const passed = status === 200 || status === 410
		results.push({
			name: 'Register page (200 or 410)',
			passed,
			status,
		})
	} catch (err) {
		results.push({
			name: 'Register page',
			passed: false,
			error: String(err),
		})
	}
}

async function testCheckoutReachable(): Promise<void> {
	try {
		const { status } = await makeRequest('GET', '/checkout')
		// Checkout page might be 200 or require auth (redirect)
		const passed = status === 200 || status === 301 || status === 302
		results.push({
			name: 'Checkout page reachable',
			passed,
			status,
		})
	} catch (err) {
		results.push({
			name: 'Checkout page reachable',
			passed: false,
			error: String(err),
		})
	}
}

async function testApiHealthEndpoint(): Promise<void> {
	try {
		const { status, body } = await makeRequest('GET', '/api/health')
		const passed = status === 200 && body.includes('ok')
		results.push({
			name: 'API /health endpoint',
			passed,
			status,
		})
	} catch (err) {
		results.push({
			name: 'API /health endpoint',
			passed: false,
			error: String(err),
		})
	}
}

async function testStripeWebhookEndpoint(): Promise<void> {
	try {
		// Webhook endpoints usually return 400/403 on test (no signature)
		const { status } = await makeRequest('POST', '/api/webhook/stripe', '{}')
		const passed = status === 400 || status === 403 || status === 401
		results.push({
			name: 'Stripe webhook endpoint protected',
			passed,
			status,
		})
	} catch (err) {
		results.push({
			name: 'Stripe webhook endpoint protected',
			passed: false,
			error: String(err),
		})
	}
}

async function runAllTests(): Promise<void> {
	console.log(`\n🧪 Staging Auth/Onboarding Verification`)
	console.log(`📍 Target: ${STAGING_URL}`)
	console.log(`⏱️  Started: ${new Date().toISOString()}\n`)

	await testSignInPageReachable()
	await testPortalPageProtected()
	await testAdminPageProtected()
	await testRegisterPageExists()
	await testCheckoutReachable()
	await testApiHealthEndpoint()
	await testStripeWebhookEndpoint()

	console.log('\n📊 Test Results:\n')
	let passed = 0
	let failed = 0

	for (const result of results) {
		const icon = result.passed ? '✅' : '❌'
		console.log(`${icon} ${result.name}`)
		if (result.status) console.log(`   Status: ${result.status}`)
		if (result.body) console.log(`   ${result.body}`)
		if (result.error) console.log(`   Error: ${result.error}`)

		if (result.passed) passed++
		else failed++
	}

	console.log(`\n📈 Summary: ${passed} passed, ${failed} failed out of ${results.length} tests`)
	console.log(`\n⚠️  This verifies endpoint reachability and basic auth flows,`)
	console.log(`    not full login/logout/email/Checkout end-to-end functionality.`)
	console.log(`    For real functional testing, use manual browser testing or E2E suite.\n`)
}

runAllTests().catch((err) => {
	console.error('Fatal error:', err)
	process.exit(1)
})
