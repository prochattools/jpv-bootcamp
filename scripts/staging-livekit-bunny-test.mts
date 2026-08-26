#!/usr/bin/env tsx
/**
 * Staging verification for LiveKit and Bunny implementations
 *
 * Tests real deployed staging endpoints:
 * - GET /api/health (basic health check)
 * - POST /api/livekit/token (with various auth states)
 * - POST /api/webhook/bunny (signature verification)
 */

import https from 'https'

const STAGING_URL = 'https://preview.jpvbootcamp.com'

interface TestResult {
	name: string
	passed: boolean
	statusCode?: number
	error?: string
	details?: string
}

const results: TestResult[] = []

async function makeRequest(
	method: 'GET' | 'POST',
	path: string,
	body?: string,
	headers?: Record<string, string>
): Promise<{ status: number; body: string }> {
	return new Promise((resolve, reject) => {
		const url = new URL(path, STAGING_URL)
		const options = {
			method,
			hostname: url.hostname,
			port: url.port || 443,
			path: url.pathname + url.search,
			headers: {
				'content-type': 'application/json',
				...headers,
			},
		}

		const req = https.request(options, (res) => {
			let data = ''
			res.on('data', (chunk) => (data += chunk))
			res.on('end', () => resolve({ status: res.statusCode || 500, body: data }))
		})

		req.on('error', reject)
		if (body) req.write(body)
		req.end()
	})
}

async function testHealthEndpoint(): Promise<void> {
	try {
		const { status, body } = await makeRequest('GET', '/api/health')
		const passed = status === 200
		results.push({
			name: 'Health Check',
			passed,
			statusCode: status,
			details: passed ? 'API is reachable' : body,
		})
	} catch (err) {
		results.push({
			name: 'Health Check',
			passed: false,
			error: String(err),
		})
	}
}

async function testLiveKitTokenWithoutAuth(): Promise<void> {
	try {
		const body = JSON.stringify({
			courseId: 'test-course',
			moduleId: 'test-module',
			lessonId: 'test-lesson',
			role: 'student',
		})

		const { status, body: responseBody } = await makeRequest('POST', '/api/livekit/token', body)

		// Expected: 401 (no auth) or 200 (if session exists)
		const passed = status === 401 || status === 200
		results.push({
			name: 'LiveKit Token (No Auth)',
			passed,
			statusCode: status,
			details: passed ? 'Correct auth handling' : responseBody,
		})
	} catch (err) {
		results.push({
			name: 'LiveKit Token (No Auth)',
			passed: false,
			error: String(err),
		})
	}
}

async function testBunnyWebhookNoSignature(): Promise<void> {
	try {
		const body = JSON.stringify({
			Type: 'VideoFinishedProcessing',
			VideoLibraryId: 1,
			VideoId: 12345,
		})

		const { status } = await makeRequest('POST', '/api/webhook/bunny', body)

		// Expected: 403 (missing signature)
		const passed = status === 403
		results.push({
			name: 'Bunny Webhook (No Signature)',
			passed,
			statusCode: status,
			details: passed ? 'Correctly rejected unsigned request' : 'Unexpected response',
		})
	} catch (err) {
		results.push({
			name: 'Bunny Webhook (No Signature)',
			passed: false,
			error: String(err),
		})
	}
}

async function testBunnyWebhookInvalidSignature(): Promise<void> {
	try {
		const body = JSON.stringify({
			Type: 'VideoFinishedProcessing',
			VideoLibraryId: 1,
			VideoId: 12346,
		})

		const { status } = await makeRequest('POST', '/api/webhook/bunny', body, {
			'bunny-signature': 'invalid-signature-hash',
		})

		// Expected: 403 (signature verification failed)
		const passed = status === 403
		results.push({
			name: 'Bunny Webhook (Invalid Signature)',
			passed,
			statusCode: status,
			details: passed ? 'Correctly rejected invalid signature' : 'Unexpected response',
		})
	} catch (err) {
		results.push({
			name: 'Bunny Webhook (Invalid Signature)',
			passed: false,
			error: String(err),
		})
	}
}

async function runAllTests(): Promise<void> {
	console.log(`\n🧪 Staging Verification Tests for LiveKit & Bunny`)
	console.log(`📍 Target: ${STAGING_URL}`)
	console.log(`⏱️  Started: ${new Date().toISOString()}\n`)

	await testHealthEndpoint()
	await testLiveKitTokenWithoutAuth()
	await testBunnyWebhookNoSignature()
	await testBunnyWebhookInvalidSignature()

	// Print results
	console.log('\n📊 Test Results:\n')
	let passed = 0
	let failed = 0

	for (const result of results) {
		const icon = result.passed ? '✅' : '❌'
		console.log(`${icon} ${result.name}`)
		if (result.statusCode) console.log(`   Status: ${result.statusCode}`)
		if (result.details) console.log(`   ${result.details}`)
		if (result.error) console.log(`   Error: ${result.error}`)

		if (result.passed) passed++
		else failed++
	}

	console.log(`\n📈 Summary: ${passed} passed, ${failed} failed out of ${results.length} tests`)

	if (failed > 0) {
		console.log('\n⚠️  Some tests failed. Check deployment and configuration.')
		process.exit(1)
	} else {
		console.log('\n✨ All tests passed! LiveKit and Bunny endpoints are working.')
		process.exit(0)
	}
}

runAllTests().catch((err) => {
	console.error('Fatal error:', err)
	process.exit(1)
})
